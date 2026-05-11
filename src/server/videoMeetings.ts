/**
 * Video meeting management using Jitsi Meet.
 * No proprietary SDK or AWS credentials required.
 * Uses the public meet.jit.si server by default, or set JITSI_BASE_URL env var
 * to point to a self-hosted Jitsi instance.
 */
import { randomUUID } from "crypto";

import { writeAuditLog } from "@/server/audit-log";
import prisma from "@/server/db";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { getCase, logTimelineEntry, updateCase } from "@/server/storage";
import type { CaseRecord } from "@/server/types";

const VIDEO_PROVIDER = "jitsi-meet";
const EARLY_JOIN_WINDOW_MS = 60 * 60 * 1000; // 1 hour before
const LATE_JOIN_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours after

interface SessionContext {
  id: string;
  subjectId: string;
  effectiveRole: string;
  effectiveEmail: string;
}

export interface VideoMeetingRecord {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: string;
  createdByEmail: string;
  createdAt: string;
  roomName: string;
}

export interface VideoJoinTokenRecord {
  meetingRecord: VideoMeetingRecord;
  meetingId: string;
  attendeeId: string;
  joinUrl: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeEmail = (v: string) => v.trim().toLowerCase();
const toComparable = (v: string | undefined | null) => (v ?? "").trim().toLowerCase();

const getJitsiBaseUrl = () => {
  const raw = process.env.JITSI_BASE_URL ?? process.env.NEXT_PUBLIC_JITSI_URL ?? "https://meet.jit.si";
  return raw.replace(/\/+$/, "");
};

const getAppBaseUrl = () => {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
};

const normalizeScheduledAt = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
};

/** Generate a URL-safe Jitsi room name tied to the case. */
const generateRoomName = (caseId: string): string => {
  const sanitized = caseId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `nrilegal-${sanitized}-${suffix}`;
};

const buildJitsiUrl = (roomName: string): string => {
  const base = getJitsiBaseUrl();
  return `${base}/${encodeURIComponent(roomName)}`;
};

const isLawyerAssignedToCase = (record: CaseRecord, session: SessionContext) => {
  const sessionUserId = toComparable(session.subjectId);
  const sessionEmail = toComparable(session.effectiveEmail);
  const assignedValues = [record.practitionerId, record.practitionerInfo?.id]
    .filter((v): v is string => Boolean(v))
    .map(toComparable);
  return assignedValues.some((v) => v === sessionUserId || v === sessionEmail);
};

const assertCaseAccess = (record: CaseRecord, session: SessionContext) => {
  const role = session.effectiveRole;
  if (role === "admin" || role === "super-admin") return;
  if (role === "client") {
    if (normalizeEmail(record.user.email) !== normalizeEmail(session.effectiveEmail))
      throw new Error("CASE_ACCESS_DENIED");
    return;
  }
  if (role === "lawyer") {
    if (!isLawyerAssignedToCase(record, session)) throw new Error("CASE_ACCESS_DENIED");
    return;
  }
  throw new Error("CASE_ACCESS_DENIED");
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Jitsi Meet room and persist the meeting record.
 */
export const createVideoMeetingForCase = async (payload: {
  caseId: string;
  scheduledAt: string;
  session: SessionContext;
}): Promise<{ meeting: VideoMeetingRecord; caseRecord: CaseRecord | null }> => {
  await ensureRuntimeSchema();

  const caseRecord = await getCase(payload.caseId);
  if (!caseRecord) throw new Error("CASE_NOT_FOUND");
  assertCaseAccess(caseRecord, payload.session);

  const scheduledAt = normalizeScheduledAt(payload.scheduledAt);
  if (!scheduledAt) throw new Error("INVALID_SCHEDULED_AT");

  const roomName = generateRoomName(payload.caseId);
  const joinUrl = buildJitsiUrl(roomName);
  const meetingId = `MTG-${randomUUID()}`;

  await prisma.$executeRaw`
    INSERT INTO Meeting (id, caseId, scheduledAt, link, provider, createdByEmail, createdAt)
    VALUES (${meetingId}, ${payload.caseId}, ${scheduledAt}, ${joinUrl}, ${VIDEO_PROVIDER}, ${normalizeEmail(payload.session.effectiveEmail)}, CURRENT_TIMESTAMP)
  `;

  const timelineEntry = {
    id: `evt-video-${Date.now()}`,
    title: "Video consultation scheduled",
    timestamp: new Date().toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    } as Intl.DateTimeFormatOptions),
    description: `Jitsi Meet consultation confirmed for ${scheduledAt}. Join link sent.`,
    actor: payload.session.effectiveRole === "lawyer" ? "Practitioner" : "Operations",
    status: "live" as const,
  };

  const updatedCase = await logTimelineEntry(payload.caseId, timelineEntry);

  // Update case stage and video slot separately
  await updateCase(payload.caseId, {
    stage: "video-scheduled",
    videoSlot: scheduledAt,
    videoLink: joinUrl,
  });

  logEvent("info", "video.meeting.created", {
    meetingId,
    caseId: payload.caseId,
    scheduledAt,
    provider: VIDEO_PROVIDER,
    createdBy: payload.session.effectiveEmail,
    roomName,
  });

  await writeAuditLog({
    actorEmail: payload.session.effectiveEmail,
    actorRole: payload.session.effectiveRole,
    action: "video.meeting.created",
    targetType: "meeting",
    targetId: meetingId,
    details: { caseId: payload.caseId, scheduledAt, roomName },
  });

  return {
    meeting: {
      id: meetingId,
      caseId: payload.caseId,
      scheduledAt,
      link: joinUrl,
      provider: VIDEO_PROVIDER,
      createdByEmail: normalizeEmail(payload.session.effectiveEmail),
      createdAt: new Date().toISOString(),
      roomName,
    },
    caseRecord: updatedCase,
  };
};

/**
 * Get a join token (Jitsi URL) for an existing meeting.
 */
export const createJoinTokenForMeeting = async (payload: {
  meetingId: string;
  session: SessionContext;
}): Promise<VideoJoinTokenRecord> => {
  await ensureRuntimeSchema();

  const rows = await prisma.$queryRaw<Array<{ id: string; caseId: string; scheduledAt: string; link: string; provider: string; createdByEmail: string; createdAt: string }>>`
    SELECT id, caseId, scheduledAt, link, provider, createdByEmail, createdAt
    FROM Meeting WHERE id = ${payload.meetingId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("MEETING_NOT_FOUND");

  const caseRecord = await getCase(row.caseId);
  if (!caseRecord) throw new Error("CASE_NOT_FOUND");
  assertCaseAccess(caseRecord, payload.session);

  // Validate join window
  const now = Date.now();
  const scheduledTime = Date.parse(row.scheduledAt);
  if (!Number.isNaN(scheduledTime)) {
    if (now < scheduledTime - EARLY_JOIN_WINDOW_MS) throw new Error("MEETING_NOT_YET_OPEN");
    if (now > scheduledTime + LATE_JOIN_WINDOW_MS) throw new Error("MEETING_EXPIRED");
  }

  const joinUrl = row.link;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  logEvent("info", "video.join.issued", {
    meetingId: payload.meetingId,
    caseId: row.caseId,
    user: payload.session.effectiveEmail,
  });

  return {
    meetingRecord: {
      id: row.id,
      caseId: row.caseId,
      scheduledAt: row.scheduledAt,
      link: row.link,
      provider: row.provider,
      createdByEmail: row.createdByEmail,
      createdAt: String(row.createdAt),
      roomName: "",
    },
    meetingId: row.id,
    attendeeId: randomUUID(),
    joinUrl,
    expiresAt,
  };
};

/**
 * Leave / end meeting � Jitsi users just close the tab, so this is a no-op.
 */
export const leaveVideoMeeting = async (payload: {
  meetingId: string;
  session: SessionContext;
}): Promise<void> => {
  logEvent("info", "video.leave", {
    meetingId: payload.meetingId,
    user: payload.session.effectiveEmail,
  });
};