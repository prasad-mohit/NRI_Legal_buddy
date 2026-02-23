import { NextResponse } from "next/server";

import { listAuditLogs } from "@/server/audit-log";
import { checkRole } from "@/server/guards";
import { logEvent } from "@/server/logger";
import { getMonitoringSnapshot } from "@/server/monitoring";
import { authorize } from "@/server/route-auth";

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
    const auditLimit = normalizeLimit(url.searchParams.get("auditLimit"), 25, 200);

    const [snapshot, recentAuditLogs] = await Promise.all([
      getMonitoringSnapshot(),
      listAuditLogs({ limit: auditLimit }),
    ]);

    logEvent("info", "monitoring.route.get", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      auditLimit,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        snapshot,
        recentAuditLogs,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logEvent("error", "monitoring.route.get_failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to load monitoring snapshot" }, { status: 500 });
  }
}
