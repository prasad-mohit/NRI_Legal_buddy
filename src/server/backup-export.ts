import prisma from "@/server/db";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

export type BackupScope = "users" | "full";
export type BackupFormat = "json" | "csv";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  country: string;
  role: string;
  isEmailVerified: number;
  passwordHash: string;
  createdAt: string;
}

interface CaseRow {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  stage: string;
  platformFeePaid: number;
  paymentStatus: string;
  caseDetails: string | null;
  caseSummary: string | null;
  caseManagerMeta: string | null;
  practitionerMeta: string | null;
  caseManagerId: string | null;
  practitionerId: string | null;
  videoSlot: string | null;
  videoLink: string | null;
  documentCount: number;
  escrowMilestones: string;
  timeline: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  caseId: string;
  name: string;
  type: string;
  status: string;
  summary: string;
  uploadedAt: string;
}

interface VideoRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  createdAt: string;
}

interface TicketRow {
  id: string;
  caseId: string | null;
  email: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MeetingRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  provider: string;
  createdByEmail: string;
  createdAt: string;
}

export interface UserBackupRecord {
  id: string;
  fullName: string;
  email: string;
  country: string;
  role: string;
  isEmailVerified: number;
  passwordHash: string;
  createdAt: string;
}

export interface UsersBackupPayload {
  generatedAt: string;
  count: number;
  users: UserBackupRecord[];
}

export interface FullBackupPayload {
  generatedAt: string;
  scope: "full";
  counts: {
    users: number;
    cases: number;
    documents: number;
    videos: number;
    tickets: number;
    meetings: number;
  };
  data: {
    users: UserBackupRecord[];
    cases: CaseRow[];
    documents: DocumentRow[];
    videos: VideoRow[];
    tickets: TicketRow[];
    meetings: MeetingRow[];
  };
}

export type BackupPayload = UsersBackupPayload | FullBackupPayload;

export const resolveBackupScope = (value: string | null): BackupScope => {
  if (value === "full") return "full";
  return "users";
};

export const resolveBackupFormat = (value: string | null): BackupFormat => {
  if (value === "csv") return "csv";
  return "json";
};

export const resolveBooleanParam = (value: string | null, fallback = false) => {
  if (value === null) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

const toUserBackup = (row: UserRow, includeSensitive: boolean): UserBackupRecord => ({
  id: row.id,
  fullName: row.fullName,
  email: row.email,
  country: row.country,
  role: row.role,
  isEmailVerified: row.isEmailVerified,
  passwordHash: includeSensitive ? row.passwordHash : "[REDACTED]",
  createdAt: row.createdAt,
});

const listUsers = async (includeSensitive: boolean) => {
  await ensureRuntimeSchema();
  const rows = (await prisma.$queryRaw`
    SELECT id, fullName, email, country, role, isEmailVerified, passwordHash, createdAt
    FROM User
    ORDER BY createdAt DESC
  `) as UserRow[];
  return rows.map((row: UserRow) => toUserBackup(row, includeSensitive));
};

export const buildUsersBackupPayload = async (
  includeSensitive: boolean
): Promise<UsersBackupPayload> => {
  const users = await listUsers(includeSensitive);
  return {
    generatedAt: new Date().toISOString(),
    count: users.length,
    users,
  };
};

export const buildFullBackupPayload = async (
  includeSensitive: boolean
): Promise<FullBackupPayload> => {
  await ensureRuntimeSchema();

  const [users, cases, documents, videos, tickets, meetings] = await Promise.all([
    listUsers(includeSensitive),
    prisma.$queryRaw<CaseRow[]>`
      SELECT c.id, c.userId, u.email as userEmail, c.serviceId, c.stage, c.platformFeePaid,
             c.paymentStatus, c.caseDetails, c.caseSummary, c.caseManagerMeta, c.practitionerMeta,
             c.caseManagerId, c.practitionerId, c.videoSlot, c.videoLink, c.documentCount,
             c.escrowMilestones, c.timeline, c.createdAt, c.updatedAt
      FROM "Case" c
      JOIN User u ON u.id = c.userId
      ORDER BY c.updatedAt DESC
    `,
    prisma.$queryRaw<DocumentRow[]>`
      SELECT id, caseId, name, type, status, summary, uploadedAt
      FROM VaultDocument
      ORDER BY uploadedAt DESC
    `,
    prisma.$queryRaw<VideoRow[]>`
      SELECT id, caseId, scheduledAt, link, createdAt
      FROM VideoReservation
      ORDER BY createdAt DESC
    `,
    prisma.$queryRaw<TicketRow[]>`
      SELECT id, caseId, email, title, description, status, createdAt, updatedAt
      FROM SupportTicket
      ORDER BY updatedAt DESC
    `,
    prisma.$queryRaw<MeetingRow[]>`
      SELECT id, caseId, scheduledAt, link, provider, createdByEmail, createdAt
      FROM Meeting
      ORDER BY createdAt DESC
    `,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    scope: "full",
    counts: {
      users: users.length,
      cases: cases.length,
      documents: documents.length,
      videos: videos.length,
      tickets: tickets.length,
      meetings: meetings.length,
    },
    data: {
      users,
      cases,
      documents,
      videos,
      tickets,
      meetings,
    },
  };
};

const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const usersToCsv = (users: UserBackupRecord[]) => {
  const header = "id,fullName,email,country,role,isEmailVerified,passwordHash,createdAt";
  const rows = users.map((row) =>
    [
      row.id,
      row.fullName,
      row.email,
      row.country,
      row.role,
      row.isEmailVerified,
      row.passwordHash,
      row.createdAt,
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header, ...rows].join("\n");
};

