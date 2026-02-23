import { NextResponse } from "next/server";

import { writeAuditLog } from "@/server/audit-log";
import {
  buildFullBackupPayload,
  buildUsersBackupPayload,
  resolveBackupFormat,
  resolveBackupScope,
  resolveBooleanParam,
  usersToCsv,
} from "@/server/backup-export";
import { checkRole } from "@/server/guards";
import { logEvent } from "@/server/logger";
import { authorize } from "@/server/route-auth";

export async function GET(req: Request) {
  const startedAt = Date.now();
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
   const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
   if (roleGuard) return roleGuard;

  try {
    const url = new URL(req.url);
    const format = resolveBackupFormat(url.searchParams.get("format"));
    const scope = resolveBackupScope(url.searchParams.get("scope"));
    const includeSensitive = resolveBooleanParam(
      url.searchParams.get("includeSensitive"),
      scope === "users"
    );

    if (format === "csv" && scope !== "users") {
      return NextResponse.json(
        { message: "CSV export is only supported for scope=users" },
        { status: 400 }
      );
    }

    const payload =
      scope === "full"
        ? await buildFullBackupPayload(includeSensitive)
        : await buildUsersBackupPayload(includeSensitive);

    await writeAuditLog({
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      action: "backup.export_generated",
      targetType: "backup",
      targetId: scope,
      details: {
        format,
        scope,
        includeSensitive,
        durationMs: Date.now() - startedAt,
      },
    });

    logEvent("info", "backup.export.generated", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      format,
      scope,
      includeSensitive,
      durationMs: Date.now() - startedAt,
    });

    if (format === "csv") {
      const users = "users" in payload ? payload.users : payload.data.users;
      const csv = usersToCsv(users);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="users-backup-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logEvent("error", "backup.export.failed", {
      actorEmail: auth.session!.effectiveEmail,
      actorRole: auth.session!.effectiveRole,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Failed to generate backup export" }, { status: 500 });
  }
}
