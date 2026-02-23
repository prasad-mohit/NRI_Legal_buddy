import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { queryRowsUnsafe } from "@/server/sql-rows";

const MAX_DETAILS_LENGTH = 8_000;

export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  createdAt: string;
}

interface WriteAuditLogInput {
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown> | string | null;
}

const normalizeLimit = (limit: number | undefined, fallback: number, max: number) => {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(limit as number)));
};

const normalizeDetails = (details: WriteAuditLogInput["details"]) => {
  if (!details) return null;
  let raw: string;
  try {
    raw = typeof details === "string" ? details : JSON.stringify(details);
  } catch {
    raw = "[UNSERIALIZABLE_DETAILS]";
  }
  if (raw.length <= MAX_DETAILS_LENGTH) return raw;
  return `${raw.slice(0, MAX_DETAILS_LENGTH)}...[TRUNCATED]`;
};

export const writeAuditLog = async (input: WriteAuditLogInput) => {
  await ensureRuntimeSchema();

  const id = `AUD-${randomUUID()}`;
  const details = normalizeDetails(input.details);

  try {
    await prisma.$executeRaw`
      INSERT INTO AuditLog (
        id, actorEmail, actorRole, action, targetType, targetId, details, createdAt
      )
      VALUES (
        ${id},
        ${input.actorEmail.toLowerCase()},
        ${input.actorRole},
        ${input.action},
        ${input.targetType},
        ${input.targetId},
        ${details},
        CURRENT_TIMESTAMP
      )
    `;
    return id;
  } catch (error) {
    logEvent("warn", "audit.write_failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
};

export const listAuditLogs = async (payload?: {
  limit?: number;
  actorEmail?: string;
  action?: string;
}): Promise<AuditLogRecord[]> => {
  await ensureRuntimeSchema();

  const limit = normalizeLimit(payload?.limit, 25, 200);
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (payload?.actorEmail) {
    clauses.push("actorEmail = ?");
    values.push(payload.actorEmail.toLowerCase());
  }

  if (payload?.action) {
    clauses.push("action = ?");
    values.push(payload.action);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = `
    SELECT id, actorEmail, actorRole, action, targetType, targetId, details, createdAt
    FROM AuditLog
    ${whereClause}
    ORDER BY createdAt DESC
    LIMIT ?
  `;

  return queryRowsUnsafe<AuditLogRecord>(query, ...values, limit);
};

export const logAction = async (params: {
  caseId: string;
  action: string;
  userId: string;
  role?: string;
  details?: Record<string, unknown> | string | null;
}) =>
  writeAuditLog({
    actorEmail: params.userId.toLowerCase(),
    actorRole: params.role ?? "system",
    action: params.action,
    targetType: "case",
    targetId: params.caseId,
    details: params.details ?? null,
  });
