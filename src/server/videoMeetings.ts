import { randomUUID } from "crypto";

import {
  ChimeSDKMeetingsClient,
  CreateAttendeeCommand,
  CreateMeetingCommand,
  DeleteAttendeeCommand,
  GetMeetingCommand,
  type Attendee,
  type Meeting,
} from "@aws-sdk/client-chime-sdk-meetings";

import { writeAuditLog } from "@/server/audit-log";
import prisma from "@/server/db";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { getCase, logTimelineEntry, updateCase } from "@/server/storage";
import type { CaseRecord } from "@/server/types";

const VIDEO_PROVIDER = "amazon-chime";
const EARLY_JOIN_WINDOW_MS = 45 * 60 * 1000;
const LATE_JOIN_WINDOW_MS = 12 * 60 * 60 * 1000;

interface SessionContext {
  id: string;
  subjectId: string;
  effectiveRole: string;
  effectiveEmail: string;
}

interface MeetingRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: string;
  createdByEmail: string;
  createdAt: string;
  chimeMeetingId: string | null;
  chimeExternalMeetingId: string | null;
  mediaRegion: string | null;
}

interface ActiveAttendeeRow {
  id: string;
  attendeeId: string;
  externalUserId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VideoMeetingRecord {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: string;
  createdByEmail: string;
  createdAt: string;
  chimeMeetingId: string;
  chimeExternalMeetingId: string;
  mediaRegion: string;
}

export interface VideoJoinTokenRecord {
  meetingRecord: VideoMeetingRecord;
  meeting: Meeting;
  attendee: Attendee;
  attendeeId: string;
  expiresAt: string;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const toComparable = (value: string | undefined | null) =>
  (value ?? "").trim().toLowerCase();

const normalizeScheduledAt = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
};

const sanitizeExternalId = (value: string, maxLength: number) => {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "");
  const trimmed = sanitized.slice(0, maxLength);
  return trimmed || randomUUID().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
};

const getMediaRegion = () =>
  (process.env.CHIME_MEDIA_REGION ?? process.env.AWS_REGION ?? "us-east-1").trim();

const getJoinTokenTtlSeconds = () => {
  const raw = Number(process.env.CHIME_JOIN_TOKEN_TTL_SECONDS ?? 900);
  if (!Number.isFinite(raw)) return 900;
  return Math.min(1800, Math.max(120, Math.trunc(raw)));
};

const getAppBaseUrl = () => {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
};

const mapMeetingRow = (row: MeetingRow): VideoMeetingRecord => {
  if (!row.chimeMeetingId || !row.chimeExternalMeetingId || !row.mediaRegion) {
    throw new Error("MEETING_METADATA_INCOMPLETE");
  }

  return {
    id: row.id,
    caseId: row.caseId,
    scheduledAt: row.scheduledAt,
    link: row.link,
    provider: row.provider,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt,
    chimeMeetingId: row.chimeMeetingId,
    chimeExternalMeetingId: row.chimeExternalMeetingId,
    mediaRegion: row.mediaRegion,
  };
};

let chimeClient: ChimeSDKMeetingsClient | null = null;

const getChimeClient = () => {
  if (chimeClient) return chimeClient;
  chimeClient = new ChimeSDKMeetingsClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });
  return chimeClient;
};

const isLawyerAssignedToCase = (record: CaseRecord, session: SessionContext) => {
  const sessionUserId = toComparable(session.subjectId);
  const sessionEmail = toComparable(session.effectiveEmail);
  const assignedValues = [record.practitionerId, record.practitionerInfo?.id]
    .filter((value): value is string => Boolean(value))
    .map(toComparable);

  return assignedValues.some((value) => value === sessionUserId || value === sessionEmail);
};

const assertCaseAccess = (record: CaseRecord, session: SessionContext) => {
  const role = session.effectiveRole;
  if (role === "admin" || role === "super-admin") return;

  if (role === "client") {
    if (normalizeEmail(record.user.email) !== normalizeEmail(session.effectiveEmail)) {
      throw new Error("CASE_ACCESS_DENIED");
    }
    return;
  }

  if (role === "lawyer") {
    if (!isLawyerAssignedToCase(record, session)) {
      throw new Error("CASE_ACCESS_DENIED");
    }
    return;
  }

  throw new Error("CASE_ACCESS_DENIED");
};

const getVideoMeetingById = async (meetingId: string): Promise<VideoMeetingRecord | null> => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    SELECT id, caseId, scheduledAt, link, provider, createdByEmail, createdAt,
           chimeMeetingId, chimeExternalMeetingId, mediaRegion
    FROM Meeting
    WHERE id = ${meetingId}
      AND provider = ${VIDEO_PROVIDER}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return mapMeetingRow(row);
};

const revokeAttendeeRows = async (payload: {
  meeting: VideoMeetingRecord;
  session: SessionContext;
  attendeeRows: ActiveAttendeeRow[];
}) => {
  if (!payload.attendeeRows.length) return;

  const client = getChimeClient();
  const revokedAt = new Date().toISOString();

  for (const attendeeRow of payload.attendeeRows) {
    try {
      await client.send(
        new DeleteAttendeeCommand({
          MeetingId: payload.meeting.chimeMeetingId,
          AttendeeId: attendeeRow.attendeeId,
        })
      );
    } catch (error) {
      logEvent("warn", "video.attendee_delete_failed", {
        meetingId: payload.meeting.id,
        chimeMeetingId: payload.meeting.chimeMeetingId,
        attendeeId: attendeeRow.attendeeId,
        actor: payload.session.effectiveEmail,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  for (const attendeeRow of payload.attendeeRows) {
    await prisma.$executeRaw`
      UPDATE MeetingAttendeeSession
      SET revokedAt = ${revokedAt}
      WHERE id = ${attendeeRow.id}
        AND revokedAt IS NULL
    `;
  }
};

const revokeExistingActiveAttendees = async (payload: {
  meeting: VideoMeetingRecord;
  session: SessionContext;
}) => {
  const rows = await prisma.$queryRaw<ActiveAttendeeRow[]>`
    SELECT id, attendeeId, externalUserId, issuedAt, expiresAt
    FROM MeetingAttendeeSession
    WHERE meetingId = ${payload.meeting.id}
      AND userEmail = ${normalizeEmail(payload.session.effectiveEmail)}
      AND revokedAt IS NULL
    ORDER BY issuedAt DESC
  `;
  await revokeAttendeeRows({
    meeting: payload.meeting,
    session: payload.session,
    attendeeRows: rows,
  });
};

const assertJoinWindow = (scheduledAt: string) => {
  const scheduledAtMs = Date.parse(scheduledAt);
  if (Number.isNaN(scheduledAtMs)) {
    throw new Error("INVALID_SCHEDULED_AT");
  }

  const now = Date.now();
  if (now < scheduledAtMs - EARLY_JOIN_WINDOW_MS) {
    throw new Error("MEETING_JOIN_TOO_EARLY");
  }
  if (now > scheduledAtMs + LATE_JOIN_WINDOW_MS) {
    throw new Error("MEETING_JOIN_WINDOW_CLOSED");
  }
};

export const createVideoMeetingForCase = async (payload: {
  caseId: string;
  scheduledAt: string;
  session: SessionContext;
}) => {
  await ensureRuntimeSchema();

  const caseRecord = await getCase(payload.caseId);
  if (!caseRecord) throw new Error("CASE_NOT_FOUND");
  assertCaseAccess(caseRecord, payload.session);

  const scheduledAt = normalizeScheduledAt(payload.scheduledAt);
  if (!scheduledAt) {
    throw new Error("INVALID_SCHEDULED_AT");
  }

  const meetingId = `MTG-${randomUUID()}`;
  const chimeExternalMeetingId = sanitizeExternalId(`${payload.caseId}-${meetingId}`, 64);
  const mediaRegion = getMediaRegion();

  const client = getChimeClient();
  const createMeetingResponse = await client.send(
    new CreateMeetingCommand({
      ClientRequestToken: randomUUID(),
      ExternalMeetingId: chimeExternalMeetingId,
      MediaRegion: mediaRegion,
    })
  );

  const chimeMeetingId = createMeetingResponse.Meeting?.MeetingId;
  if (!chimeMeetingId) {
    throw new Error("CHIME_MEETING_CREATE_FAILED");
  }

  const link = `${getAppBaseUrl()}/meeting/${encodeURIComponent(meetingId)}`;

  await prisma.$executeRaw`
    INSERT INTO Meeting (
      id, caseId, scheduledAt, link, provider, createdByEmail,
      chimeMeetingId, chimeExternalMeetingId, mediaRegion, createdAt
    )
    VALUES (
      ${meetingId},
      ${payload.caseId},
      ${scheduledAt},
      ${link},
      ${VIDEO_PROVIDER},
      ${normalizeEmail(payload.session.effectiveEmail)},
      ${chimeMeetingId},
      ${chimeExternalMeetingId},
      ${mediaRegion},
      CURRENT_TIMESTAMP
    )
  `;

  let updatedCase = await updateCase(payload.caseId, {
    stage: "video-scheduled",
    videoSlot: scheduledAt,
    videoLink: link,
  });

  updatedCase = await logTimelineEntry(payload.caseId, {
    id: `evt-video-${Date.now()}`,
    title: "Video consultation scheduled",
    description: `Amazon Chime meeting confirmed for ${scheduledAt}.`,
    actor: payload.session.effectiveRole === "lawyer" ? "Practitioner" : "Operations",
    timestamp: new Date().toISOString(),
    status: "live",
  });

  await writeAuditLog({
    actorEmail: payload.session.effectiveEmail,
    actorRole: payload.session.effectiveRole,
    action: "video.meeting.create",
    targetType: "meeting",
    targetId: meetingId,
    details: {
      caseId: payload.caseId,
      chimeMeetingId,
      mediaRegion,
      scheduledAt,
    },
  });

  const meetingRecord = await getVideoMeetingById(meetingId);
  if (!meetingRecord) {
    throw new Error("MEETING_NOT_FOUND_AFTER_CREATE");
  }

  logEvent("info", "video.meeting_created", {
    meetingId,
    caseId: payload.caseId,
    actor: payload.session.effectiveEmail,
    mediaRegion,
  });

  return {
    meeting: meetingRecord,
    caseRecord: updatedCase,
  };
};

export const createJoinTokenForMeeting = async (payload: {
  meetingId: string;
  session: SessionContext;
}): Promise<VideoJoinTokenRecord> => {
  await ensureRuntimeSchema();

  const meetingRecord = await getVideoMeetingById(payload.meetingId);
  if (!meetingRecord) {
    throw new Error("MEETING_NOT_FOUND");
  }

  const caseRecord = await getCase(meetingRecord.caseId);
  if (!caseRecord) {
    throw new Error("CASE_NOT_FOUND");
  }
  assertCaseAccess(caseRecord, payload.session);
  assertJoinWindow(meetingRecord.scheduledAt);

  await revokeExistingActiveAttendees({
    meeting: meetingRecord,
    session: payload.session,
  });

  const client = getChimeClient();
  const meetingResponse = await client.send(
    new GetMeetingCommand({
      MeetingId: meetingRecord.chimeMeetingId,
    })
  );
  if (!meetingResponse.Meeting) {
    throw new Error("CHIME_MEETING_NOT_FOUND");
  }

  const externalUserId = sanitizeExternalId(
    `${payload.session.effectiveRole}-${payload.session.subjectId}-${Date.now()}`,
    64
  );
  const attendeeResponse = await client.send(
    new CreateAttendeeCommand({
      MeetingId: meetingRecord.chimeMeetingId,
      ExternalUserId: externalUserId,
    })
  );
  const attendee = attendeeResponse.Attendee;
  if (!attendee?.AttendeeId || !attendee.JoinToken) {
    throw new Error("CHIME_ATTENDEE_CREATE_FAILED");
  }

  const ttlSeconds = getJoinTokenTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const attendeeSessionId = `ATS-${randomUUID()}`;
  await prisma.$executeRaw`
    INSERT INTO MeetingAttendeeSession (
      id, meetingId, caseId, attendeeId, externalUserId, userEmail, userRole, issuedAt, expiresAt
    )
    VALUES (
      ${attendeeSessionId},
      ${meetingRecord.id},
      ${meetingRecord.caseId},
      ${attendee.AttendeeId},
      ${externalUserId},
      ${normalizeEmail(payload.session.effectiveEmail)},
      ${payload.session.effectiveRole},
      CURRENT_TIMESTAMP,
      ${expiresAt}
    )
  `;

  await writeAuditLog({
    actorEmail: payload.session.effectiveEmail,
    actorRole: payload.session.effectiveRole,
    action: "video.meeting.join",
    targetType: "meeting",
    targetId: meetingRecord.id,
    details: {
      caseId: meetingRecord.caseId,
      attendeeId: attendee.AttendeeId,
      attendeeSessionId,
      expiresAt,
    },
  });

  return {
    meetingRecord,
    meeting: meetingResponse.Meeting,
    attendee,
    attendeeId: attendee.AttendeeId,
    expiresAt,
  };
};

export const leaveVideoMeeting = async (payload: {
  meetingId: string;
  attendeeId: string;
  session: SessionContext;
}) => {
  await ensureRuntimeSchema();

  const meetingRecord = await getVideoMeetingById(payload.meetingId);
  if (!meetingRecord) {
    throw new Error("MEETING_NOT_FOUND");
  }

  const caseRecord = await getCase(meetingRecord.caseId);
  if (!caseRecord) {
    throw new Error("CASE_NOT_FOUND");
  }
  assertCaseAccess(caseRecord, payload.session);

  const rows = await prisma.$queryRaw<ActiveAttendeeRow[]>`
    SELECT id, attendeeId, externalUserId, issuedAt, expiresAt
    FROM MeetingAttendeeSession
    WHERE meetingId = ${meetingRecord.id}
      AND attendeeId = ${payload.attendeeId}
      AND userEmail = ${normalizeEmail(payload.session.effectiveEmail)}
      AND revokedAt IS NULL
    ORDER BY issuedAt DESC
    LIMIT 1
  `;

  const attendeeRow = rows[0];
  if (!attendeeRow) {
    return { ok: true };
  }

  await revokeAttendeeRows({
    meeting: meetingRecord,
    session: payload.session,
    attendeeRows: [attendeeRow],
  });

  await writeAuditLog({
    actorEmail: payload.session.effectiveEmail,
    actorRole: payload.session.effectiveRole,
    action: "video.meeting.leave",
    targetType: "meeting",
    targetId: meetingRecord.id,
    details: {
      caseId: meetingRecord.caseId,
      attendeeId: attendeeRow.attendeeId,
    },
  });

  return { ok: true };
};
