import { NextResponse } from "next/server";

import { logEvent } from "@/server/logger";
import { authorize } from "@/server/route-auth";
import {
  createSupportTicket,
  listSupportTicketsForRequester,
  parseSupportTicketStatus,
} from "@/server/tickets";

const normalizeLimit = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
};

export async function GET(req: Request) {
  const startedAt = Date.now();
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = parseSupportTicketStatus(statusParam);
    if (statusParam && status === null) {
      return NextResponse.json({ message: "Invalid status filter" }, { status: 400 });
    }

    const tickets = await listSupportTicketsForRequester({
      email: auth.session!.effectiveEmail,
      status: status ?? undefined,
      caseId: url.searchParams.get("caseId") ?? undefined,
      limit: normalizeLimit(url.searchParams.get("limit"), 50, 200),
    });

    logEvent("info", "tickets.route.get", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      count: tickets.length,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    logEvent("error", "tickets.route.get_failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to list tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      caseId?: string;
      title?: string;
      description?: string;
    };
    const created = await createSupportTicket({
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      caseId: body.caseId,
      title: body.title,
      description: body.description,
    });

    if (!created.ok) {
      return NextResponse.json({ message: created.message }, { status: created.status });
    }

    logEvent("info", "tickets.route.post", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      ticketId: created.data.id,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        id: created.data.id,
        status: created.data.status,
        ticket: created.data,
      },
      { status: 201 }
    );
  } catch (error) {
    const invalidPayload =
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.includes("JSON"));
    if (invalidPayload) {
      return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
    }
    logEvent("error", "tickets.route.post_failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to create ticket" }, { status: 500 });
  }
}
