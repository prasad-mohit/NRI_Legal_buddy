import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { normalizeEmail } from "@/server/auth";
import { writeAuditLog } from "@/server/audit-log";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { queryRowsUnsafe } from "@/server/sql-rows";

export type SupportTicketStatus = "open" | "in-progress" | "closed";

const VALID_STATUSES = new Set<SupportTicketStatus>(["open", "in-progress", "closed"]);

export interface SupportTicketRecord {
  id: string;
  caseId: string | null;
  email: string;
  title: string;
  description: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
}

type TicketResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

interface SupportTicketRow {
  id: string;
  caseId: string | null;
  email: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeLimit = (value: number | undefined, fallback: number, max: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value as number)));
};

const normalizeTitle = (value: string | undefined) => (value ?? "").trim();
const normalizeDescription = (value: string | undefined) => (value ?? "").trim();
const normalizeCaseId = (value: string | undefined) => {
  const next = (value ?? "").trim();
  return next.length ? next : null;
};

const mapTicketRow = (row: SupportTicketRow): SupportTicketRecord => ({
  id: row.id,
  caseId: row.caseId,
  email: row.email,
  title: row.title,
  description: row.description,
  status: (VALID_STATUSES.has(row.status as SupportTicketStatus)
    ? row.status
    : "open") as SupportTicketStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const parseSupportTicketStatus = (value: string | null | undefined) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase() as SupportTicketStatus;
  if (!VALID_STATUSES.has(normalized)) return null;
  return normalized;
};

const fetchTickets = async (payload: {
  email?: string;
  status?: SupportTicketStatus;
  caseId?: string;
  limit?: number;
}) => {
  await ensureRuntimeSchema();

  const limit = normalizeLimit(payload.limit, 50, 500);
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (payload.email) {
    clauses.push("email = ?");
    values.push(normalizeEmail(payload.email));
  }

  if (payload.status) {
    clauses.push("status = ?");
    values.push(payload.status);
  }

  if (payload.caseId) {
    clauses.push("caseId = ?");
    values.push(payload.caseId);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = `
    SELECT id, caseId, email, title, description, status, createdAt, updatedAt
    FROM SupportTicket
    ${whereClause}
    ORDER BY updatedAt DESC
    LIMIT ?
  `;

  const rows = await queryRowsUnsafe<SupportTicketRow>(query, ...values, limit);
  return rows.map(mapTicketRow);
};

export const listSupportTicketsForRequester = async (payload: {
  email: string;
  status?: SupportTicketStatus;
  caseId?: string;
  limit?: number;
}) => {
  const tickets = await fetchTickets({
    email: payload.email,
    status: payload.status,
    caseId: payload.caseId,
    limit: payload.limit,
  });

  logEvent("info", "tickets.list.requester", {
    email: normalizeEmail(payload.email),
    status: payload.status ?? "all",
    caseId: payload.caseId ?? "all",
    count: tickets.length,
  });
  return tickets;
};

export const listSupportTicketsForAdmin = async (payload?: {
  email?: string;
  status?: SupportTicketStatus;
  caseId?: string;
  limit?: number;
}) => {
  const tickets = await fetchTickets({
    email: payload?.email,
    status: payload?.status,
    caseId: payload?.caseId,
    limit: payload?.limit ?? 100,
  });

  logEvent("info", "tickets.list.admin", {
    emailFilter: payload?.email ?? "all",
    status: payload?.status ?? "all",
    caseId: payload?.caseId ?? "all",
    count: tickets.length,
  });
  return tickets;
};

const getTicketById = async (id: string) => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<SupportTicketRow[]>`
    SELECT id, caseId, email, title, description, status, createdAt, updatedAt
    FROM SupportTicket
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapTicketRow(row) : null;
};

const validateTicketBody = (title: string, description: string): string | null => {
  if (title.length < 5 || title.length > 160) {
    return "Title must be between 5 and 160 characters";
  }
  if (description.length < 10 || description.length > 5_000) {
    return "Description must be between 10 and 5000 characters";
  }
  return null;
};

const validateCaseAccess = async (payload: {
  caseId: string;
  actorEmail: string;
  actorRole: string;
}): Promise<TicketResult<null>> => {
  const rows = await prisma.$queryRaw<Array<{ id: string; ownerEmail: string }>>`
    SELECT c.id, u.email as ownerEmail
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    WHERE c.id = ${payload.caseId}
    LIMIT 1
  `;

  const record = rows[0];
  if (!record) {
    return { ok: false, status: 404, message: "Case not found" };
  }

  if (
    payload.actorRole === "client" &&
    record.ownerEmail.toLowerCase() !== payload.actorEmail.toLowerCase()
  ) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, data: null };
};

export const createSupportTicket = async (payload: {
  actorEmail: string;
  actorRole: string;
  caseId?: string;
  title?: string;
  description?: string;
}): Promise<TicketResult<SupportTicketRecord>> => {
  await ensureRuntimeSchema();

  const email = normalizeEmail(payload.actorEmail);
  const title = normalizeTitle(payload.title);
  const description = normalizeDescription(payload.description);
  const caseId = normalizeCaseId(payload.caseId);

  const validationError = validateTicketBody(title, description);
  if (validationError) {
    return { ok: false, status: 400, message: validationError };
  }

  if (caseId) {
    const caseAccess = await validateCaseAccess({
      caseId,
      actorEmail: email,
      actorRole: payload.actorRole,
    });
    if (!caseAccess.ok) return caseAccess;
  }

  const id = `TKT-${randomUUID()}`;
  await prisma.$executeRaw`
    INSERT INTO SupportTicket (
      id, caseId, email, title, description, status, createdAt, updatedAt
    )
    VALUES (
      ${id},
      ${caseId},
      ${email},
      ${title},
      ${description},
      ${"open"},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  const created = await getTicketById(id);
  if (!created) {
    return { ok: false, status: 500, message: "Failed to create ticket" };
  }

  await writeAuditLog({
    actorEmail: email,
    actorRole: payload.actorRole,
    action: "ticket.created",
    targetType: "support-ticket",
    targetId: id,
    details: {
      caseId: created.caseId,
      status: created.status,
    },
  });

  logEvent("info", "tickets.created", {
    id,
    actorEmail: email,
    actorRole: payload.actorRole,
    caseId: created.caseId,
  });

  return { ok: true, data: created };
};

export const updateSupportTicketStatus = async (payload: {
  id?: string;
  status?: SupportTicketStatus;
  actorEmail: string;
  actorRole: string;
}): Promise<TicketResult<SupportTicketRecord>> => {
  await ensureRuntimeSchema();

  const id = (payload.id ?? "").trim();
  if (!id || !payload.status || !VALID_STATUSES.has(payload.status)) {
    return { ok: false, status: 400, message: "Invalid ticket id or status" };
  }

  const existing = await getTicketById(id);
  if (!existing) {
    return { ok: false, status: 404, message: "Ticket not found" };
  }

  await prisma.$executeRaw`
    UPDATE SupportTicket
    SET status = ${payload.status},
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;

  const updated = await getTicketById(id);
  if (!updated) {
    return { ok: false, status: 500, message: "Failed to update ticket" };
  }

  await writeAuditLog({
    actorEmail: normalizeEmail(payload.actorEmail),
    actorRole: payload.actorRole,
    action: "ticket.status_updated",
    targetType: "support-ticket",
    targetId: id,
    details: {
      beforeStatus: existing.status,
      afterStatus: updated.status,
      ownerEmail: updated.email,
    },
  });

  logEvent("info", "tickets.status_updated", {
    id,
    actorEmail: normalizeEmail(payload.actorEmail),
    actorRole: payload.actorRole,
    beforeStatus: existing.status,
    afterStatus: updated.status,
  });

  return { ok: true, data: updated };
};

