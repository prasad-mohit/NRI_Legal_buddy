import { NextResponse } from "next/server";

import { checkCaseState } from "@/server/guards";
import { getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { authorize } from "@/server/route-auth";
import { createVideoMeetingForCase } from "@/server/videoMeetings";

const CREATE_WINDOW_MS = 10 * 60 * 1000;
const CREATE_BLOCK_MS = 15 * 60 * 1000;

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authorize(["lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  let body: { caseId?: string; scheduledAt?: string };
  try {
    body = (await req.json()) as { caseId?: string; scheduledAt?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const caseId = (body.caseId ?? "").trim();
  const scheduledAt = (body.scheduledAt ?? "").trim();
  if (!caseId || !scheduledAt) {
    return NextResponse.json({ message: "Missing caseId or scheduledAt" }, { status: 400 });
  }

  const caseState = await checkCaseState(caseId, [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_APPROVAL",
    "PAYMENT_PENDING",
    "IN_PROGRESS",
    "CLOSED",
  ]);
  if (caseState.response) return caseState.response;

  const ipLimit = await consumeRateLimit({
    bucket: "video-create-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 30,
    windowMs: CREATE_WINDOW_MS,
    blockMs: CREATE_BLOCK_MS,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many video meeting requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const userLimit = await consumeRateLimit({
    bucket: "video-create-user",
    subject: `${auth.session!.effectiveEmail}|${caseId}`,
    maxAttempts: 20,
    windowMs: CREATE_WINDOW_MS,
    blockMs: CREATE_BLOCK_MS,
  });
  if (!userLimit.allowed) {
    return NextResponse.json(
      { message: "Too many video meeting requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(userLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const result = await createVideoMeetingForCase({
      caseId,
      scheduledAt,
      session: auth.session!,
    });

    return NextResponse.json(
      {
        meeting: result.meeting,
        caseRecord: result.caseRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    if (reason === "CASE_NOT_FOUND") {
      return NextResponse.json({ message: "Case not found" }, { status: 404 });
    }
    if (reason === "CASE_ACCESS_DENIED") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (reason === "INVALID_SCHEDULED_AT") {
      return NextResponse.json(
        { message: "scheduledAt must be a valid datetime string" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Unable to create video meeting" }, { status: 500 });
  }
}
