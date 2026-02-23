import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { logTimelineEntry, updateCase } from "@/server/storage";
import type { CaseRecord } from "@/server/types";

const VALID_MEETING_PROVIDERS = [
  "google-meet",
  "zoom",
  "teams",
  "custom",
  "amazon-chime",
] as const;

export type MeetingProvider = (typeof VALID_MEETING_PROVIDERS)[number];

interface MeetingRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: string;
  createdByEmail: string;
  createdAt: string;
}

export interface MeetingRecord {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: MeetingProvider;
  createdByEmail: string;
  createdAt: string;
}

interface ScheduleMeetingPayload {
  caseId: string;
  scheduledAt: string;
  provider: MeetingProvider;
  link?: string;
  createdByEmail: string;
  actorRole: string;
}

const DEFAULT_MEET_BASE_URL = "https://meet.nri-law-buddy.com";
const DEFAULT_ZOOM_BASE_URL = "https://zoom.us/j";
const DEFAULT_TEAMS_BASE_URL = "https://teams.microsoft.com/l/meetup-join";

const isHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

const sanitizeBaseUrl = (value: string | undefined, fallback: string) =>
  (value ?? fallback).trim().replace(/\/+$/, "");

const normalizeScheduledAt = (value: string) => {
  const next = value.trim();
  if (!next) return null;
  const timestamp = Date.parse(next);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const mapMeetingRow = (row: MeetingRow): MeetingRecord => ({
  id: row.id,
  caseId: row.caseId,
  scheduledAt: row.scheduledAt,
  link: row.link,
  provider: normalizeMeetingProvider(row.provider) ?? "custom",
  createdByEmail: row.createdByEmail,
  createdAt: row.createdAt,
});

const buildProviderLink = (payload: {
  provider: MeetingProvider;
  caseId: string;
  meetingId: string;
  customLink?: string;
}) => {
  if (payload.provider === "custom") {
    const customLink = (payload.customLink ?? "").trim();
    if (!customLink || !isHttpsUrl(customLink)) {
      throw new Error("INVALID_MEETING_LINK");
    }
    return customLink;
  }

  const token = payload.meetingId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const meetBase = sanitizeBaseUrl(process.env.MEETING_GOOGLE_MEET_BASE_URL, DEFAULT_MEET_BASE_URL);
  const zoomBase = sanitizeBaseUrl(process.env.MEETING_ZOOM_BASE_URL, DEFAULT_ZOOM_BASE_URL);
  const teamsBase = sanitizeBaseUrl(process.env.MEETING_TEAMS_BASE_URL, DEFAULT_TEAMS_BASE_URL);

  if (payload.provider === "google-meet") {
    const slug = `${token.slice(0, 3)}-${token.slice(3, 7)}-${token.slice(7, 10)}`;
    return `${meetBase}/${slug}`;
  }

  if (payload.provider === "zoom") {
    const roomId = token.slice(0, 11).padEnd(11, "0");
    return `${zoomBase}/${roomId}`;
  }

  if (payload.provider === "amazon-chime") {
    const appBase = (process.env.APP_BASE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
    return `${appBase}/meeting/${encodeURIComponent(payload.meetingId)}`;
  }

  const teamsMeetingCode = encodeURIComponent(`19:meeting_${token}@thread.v2`);
  return `${teamsBase}/${teamsMeetingCode}`;
};

export const normalizeMeetingProvider = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!VALID_MEETING_PROVIDERS.includes(normalized as MeetingProvider)) return null;
  return normalized as MeetingProvider;
};

export const listMeetingsForCase = async (caseId: string): Promise<MeetingRecord[]> => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    SELECT id, caseId, scheduledAt, link, provider, createdByEmail, createdAt
    FROM Meeting
    WHERE caseId = ${caseId}
    ORDER BY createdAt DESC
  `;
  return rows.map(mapMeetingRow);
};

export const scheduleMeetingForCase = async (
  payload: ScheduleMeetingPayload
): Promise<{ meeting: MeetingRecord; caseRecord: CaseRecord }> => {
  await ensureRuntimeSchema();

  const scheduledAt = normalizeScheduledAt(payload.scheduledAt);
  if (!scheduledAt) {
    throw new Error("INVALID_SCHEDULED_AT");
  }

  const meetingId = `MTG-${randomUUID()}`;
  const link = buildProviderLink({
    provider: payload.provider,
    caseId: payload.caseId,
    meetingId,
    customLink: payload.link,
  });

  await prisma.$executeRaw`
    INSERT INTO Meeting (id, caseId, scheduledAt, link, provider, createdByEmail, createdAt)
    VALUES (
      ${meetingId},
      ${payload.caseId},
      ${scheduledAt},
      ${link},
      ${payload.provider},
      ${payload.createdByEmail},
      CURRENT_TIMESTAMP
    )
  `;

  let caseRecord = await updateCase(payload.caseId, {
    stage: "video-scheduled",
    videoSlot: scheduledAt,
    videoLink: link,
  });

  caseRecord = await logTimelineEntry(payload.caseId, {
    id: `evt-meeting-${Date.now()}`,
    title: "Meeting scheduled",
    description: `Meeting confirmed for ${scheduledAt} via ${payload.provider}.`,
    actor: payload.actorRole === "lawyer" ? "Practitioner" : "Operations",
    timestamp: new Date().toISOString(),
    status: "live",
  });

  const meetings = await listMeetingsForCase(payload.caseId);
  const meeting = meetings.find((item) => item.id === meetingId);
  if (!meeting) {
    throw new Error("MEETING_NOT_FOUND_AFTER_CREATE");
  }

  logEvent("info", "meetings.scheduled", {
    caseId: payload.caseId,
    meetingId,
    provider: payload.provider,
    createdByEmail: payload.createdByEmail,
  });

  return { meeting, caseRecord };
};
