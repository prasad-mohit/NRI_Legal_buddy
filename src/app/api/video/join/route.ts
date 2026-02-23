import { NextResponse } from "next/server";

import { getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { authorize } from "@/server/route-auth";
import { createJoinTokenForMeeting, leaveVideoMeeting } from "@/server/videoMeetings";

const JOIN_WINDOW_MS = 5 * 60 * 1000;
const JOIN_BLOCK_MS = 10 * 60 * 1000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  const meetingId = new URL(req.url).searchParams.get("meetingId")?.trim();
  if (!meetingId) {
    return NextResponse.json({ message: "Missing meetingId" }, { status: 400 });
  }

  const ipLimit = await consumeRateLimit({
    bucket: "video-join-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 40,
    windowMs: JOIN_WINDOW_MS,
    blockMs: JOIN_BLOCK_MS,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many join attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const userLimit = await consumeRateLimit({
    bucket: "video-join-user",
    subject: `${auth.session!.effectiveEmail}|${meetingId}`,
    maxAttempts: 20,
    windowMs: JOIN_WINDOW_MS,
    blockMs: JOIN_BLOCK_MS,
  });
  if (!userLimit.allowed) {
    return NextResponse.json(
      { message: "Too many join attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(userLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const join = await createJoinTokenForMeeting({
      meetingId,
      session: auth.session!,
    });
    return NextResponse.json({
      meetingId: join.meetingRecord.id,
      caseId: join.meetingRecord.caseId,
      scheduledAt: join.meetingRecord.scheduledAt,
      link: join.meetingRecord.link,
      join: {
        meeting: join.meeting,
        attendee: join.attendee,
        attendeeId: join.attendeeId,
        expiresAt: join.expiresAt,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    if (reason === "MEETING_NOT_FOUND" || reason === "CASE_NOT_FOUND") {
      return NextResponse.json({ message: "Meeting not found" }, { status: 404 });
    }
    if (reason === "CASE_ACCESS_DENIED") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (reason === "MEETING_JOIN_TOO_EARLY") {
      return NextResponse.json(
        { message: "Meeting join is not available yet." },
        { status: 403 }
      );
    }
    if (reason === "MEETING_JOIN_WINDOW_CLOSED") {
      return NextResponse.json(
        { message: "Meeting join window has closed." },
        { status: 410 }
      );
    }
    return NextResponse.json({ message: "Unable to generate meeting token" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  let body: { meetingId?: string; attendeeId?: string };
  try {
    body = (await req.json()) as { meetingId?: string; attendeeId?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const meetingId = (body.meetingId ?? "").trim();
  const attendeeId = (body.attendeeId ?? "").trim();
  if (!meetingId || !attendeeId) {
    return NextResponse.json({ message: "Missing meetingId or attendeeId" }, { status: 400 });
  }

  try {
    await leaveVideoMeeting({
      meetingId,
      attendeeId,
      session: auth.session!,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    if (reason === "MEETING_NOT_FOUND" || reason === "CASE_NOT_FOUND") {
      return NextResponse.json({ message: "Meeting not found" }, { status: 404 });
    }
    if (reason === "CASE_ACCESS_DENIED") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ message: "Unable to leave meeting" }, { status: 500 });
  }
}
