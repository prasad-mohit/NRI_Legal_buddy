import { NextResponse } from "next/server";

import { checkRole } from "@/server/guards";
import { logEvent } from "@/server/logger";
import { authorize } from "@/server/route-auth";
import {
  listSupportTicketsForAdmin,
  parseSupportTicketStatus,
  updateSupportTicketStatus,
} from "@/server/tickets";

const normalizeLimit = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
};

export async function GET(req: Request) {
  const startedAt = Date.now();
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = parseSupportTicketStatus(statusParam);
    if (statusParam && status === null) {
      return NextResponse.json({ message: "Invalid status filter" }, { status: 400 });
    }

    const tickets = await listSupportTicketsForAdmin({
      status: status ?? undefined,
      email: url.searchParams.get("email") ?? undefined,
      caseId: url.searchParams.get("caseId") ?? undefined,
      limit: normalizeLimit(url.searchParams.get("limit"), 100, 500),
    });

    logEvent("info", "admin.tickets.route.get", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      count: tickets.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    logEvent("error", "admin.tickets.route.get_failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to list tickets" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const startedAt = Date.now();
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;

  try {
    const body = (await req.json()) as { id?: string; status?: string };
    const parsedStatus = parseSupportTicketStatus(body.status);
    if (!body.id || !parsedStatus) {
      return NextResponse.json({ message: "Missing id or status" }, { status: 400 });
    }

    const updated = await updateSupportTicketStatus({
      id: body.id,
      status: parsedStatus,
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
    });

    if (!updated.ok) {
      return NextResponse.json({ message: updated.message }, { status: updated.status });
    }

    logEvent("info", "admin.tickets.route.patch", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      ticketId: updated.data.id,
      nextStatus: updated.data.status,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, ticket: updated.data });
  } catch (error) {
    const invalidPayload =
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.includes("JSON"));
    if (invalidPayload) {
      return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
    }
    logEvent("error", "admin.tickets.route.patch_failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to update ticket" }, { status: 500 });
  }
}
