import { NextResponse } from "next/server";

import { listMeetingsForCase, normalizeMeetingProvider, scheduleMeetingForCase } from "@/server/meetings";
import { checkCaseState } from "@/server/guards";
import { getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { authorize } from "@/server/route-auth";

const MEETING_WINDOW_MS = 10 * 60 * 1000;
const MEETING_BLOCK_MS = 15 * 60 * 1000;

const getCaseForAuthorizedUser = async (payload: {
  caseId: string;
  role: string;
  email: string;
  subjectId: string;
}) => {
  const caseState = await checkCaseState(payload.caseId, [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_APPROVAL",
    "PAYMENT_PENDING",
    "IN_PROGRESS",
    "CLOSED",
  ]);
  if (caseState.response) {
    return { status: caseState.response.status, message: "Forbidden", record: null };
  }
  const record = caseState.record!;

  if (payload.role === "client" && record.user.email !== payload.email) {
    return { status: 403, message: "Forbidden", record: null };
  }

  if (payload.role === "lawyer") {
    const assignedValues = [record.practitionerId, record.practitionerInfo?.id]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase());
    const userKeys = [payload.subjectId, payload.email].map((value) =>
      value.trim().toLowerCase()
    );
    const allowed = assignedValues.some((value) => userKeys.includes(value));
    if (!allowed) {
      return { status: 403, message: "Forbidden", record: null };
    }
  }

  return { status: 200, message: "", record };
};

export async function GET(req: Request) {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  const caseId = new URL(req.url).searchParams.get("caseId")?.trim();
  if (!caseId) {
    return NextResponse.json({ message: "Missing caseId" }, { status: 400 });
  }

  const caseAccess = await getCaseForAuthorizedUser({
    caseId,
    role: auth.session!.effectiveRole,
    email: auth.session!.effectiveEmail,
    subjectId: auth.session!.subjectId,
  });
  if (!caseAccess.record) {
    return NextResponse.json({ message: caseAccess.message }, { status: caseAccess.status });
  }

  const meetings = await listMeetingsForCase(caseId);
  return NextResponse.json({ meetings });
}

export async function POST(req: Request) {
  const auth = await authorize(["lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  let body: {
    caseId?: string;
    scheduledAt?: string;
    provider?: string;
    link?: string;
  };
  try {
    body = (await req.json()) as {
      caseId?: string;
      scheduledAt?: string;
      provider?: string;
      link?: string;
    };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const caseId = (body.caseId ?? "").trim();
  const scheduledAt = (body.scheduledAt ?? "").trim();
  const provider = normalizeMeetingProvider(body.provider);
  const link = body.link?.trim();

  if (!caseId || !scheduledAt || !provider) {
    return NextResponse.json({ message: "Missing meeting details" }, { status: 400 });
  }

  const caseAccess = await getCaseForAuthorizedUser({
    caseId,
    role: auth.session!.effectiveRole,
    email: auth.session!.effectiveEmail,
    subjectId: auth.session!.subjectId,
  });
  if (!caseAccess.record) {
    return NextResponse.json({ message: caseAccess.message }, { status: caseAccess.status });
  }

  const ipLimit = await consumeRateLimit({
    bucket: "meetings-create-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 30,
    windowMs: MEETING_WINDOW_MS,
    blockMs: MEETING_BLOCK_MS,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many meeting requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimit.retryAfterSeconds),
        },
      }
    );
  }

  const userLimit = await consumeRateLimit({
    bucket: "meetings-create-user",
    subject: `${auth.session!.effectiveEmail}|${caseId}`,
    maxAttempts: 12,
    windowMs: MEETING_WINDOW_MS,
    blockMs: MEETING_BLOCK_MS,
  });
  if (!userLimit.allowed) {
    return NextResponse.json(
      { message: "Too many meeting requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(userLimit.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const result = await scheduleMeetingForCase({
      caseId,
      scheduledAt,
      provider,
      link,
      createdByEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
    });
    return NextResponse.json({ id: result.meeting.id }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    if (reason === "INVALID_SCHEDULED_AT") {
      return NextResponse.json(
        { message: "scheduledAt must be a valid datetime string" },
        { status: 400 }
      );
    }
    if (reason === "INVALID_MEETING_LINK") {
      return NextResponse.json(
        { message: "Custom meetings require a valid HTTPS link" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Unable to schedule meeting" }, { status: 500 });
  }
}
