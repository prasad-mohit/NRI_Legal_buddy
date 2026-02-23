import prisma from "@/server/db";
import { logEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

interface CountRow {
  count: number | bigint;
}

interface GroupRow {
  key: string;
  count: number | bigint;
}

const toCount = (value: number | bigint | null | undefined) => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const mapGroupRows = (rows: GroupRow[]) =>
  rows.map((row) => ({
    key: row.key,
    count: toCount(row.count),
  }));

export interface MonitoringSnapshot {
  generatedAt: string;
  environment: string;
  node: {
    uptimeSeconds: number;
    rssMb: number;
    heapUsedMb: number;
  };
  health: {
    database: "ok" | "error";
  };
  counters: {
    users: number;
    usersVerified: number;
    cases: number;
    casesPendingPayment: number;
    ticketsOpen: number;
    sessionsActive: number;
    meetingsUpcoming: number;
  };
  breakdowns: {
    caseStage: Array<{ key: string; count: number }>;
    ticketStatus: Array<{ key: string; count: number }>;
  };
}

export const getMonitoringSnapshot = async (): Promise<MonitoringSnapshot> => {
  const startedAt = Date.now();
  await ensureRuntimeSchema();

  const nowIso = new Date().toISOString();
  let databaseState: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
  } catch {
    databaseState = "error";
  }

  const [
    usersRows,
    verifiedRows,
    casesRows,
    pendingPaymentRows,
    activeSessionRows,
    openTicketRows,
    meetingsRows,
    caseStageRows,
    ticketStatusRows,
  ] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(1) as count FROM User`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(1) as count FROM User WHERE isEmailVerified = 1`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(1) as count FROM "Case"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(1) as count
      FROM "Case"
      WHERE paymentStatus = ${"pending"}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(1) as count
      FROM Session
      WHERE revokedAt IS NULL
        AND expiresAt > ${nowIso}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(1) as count
      FROM SupportTicket
      WHERE status != ${"closed"}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(1) as count
      FROM Meeting
      WHERE scheduledAt >= ${nowIso}
    `,
    prisma.$queryRaw<GroupRow[]>`
      SELECT stage as key, COUNT(1) as count
      FROM "Case"
      GROUP BY stage
      ORDER BY count DESC
    `,
    prisma.$queryRaw<GroupRow[]>`
      SELECT status as key, COUNT(1) as count
      FROM SupportTicket
      GROUP BY status
      ORDER BY count DESC
    `,
  ]);

  const memory = process.memoryUsage();
  const snapshot: MonitoringSnapshot = {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    node: {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
    },
    health: {
      database: databaseState,
    },
    counters: {
      users: toCount(usersRows[0]?.count),
      usersVerified: toCount(verifiedRows[0]?.count),
      cases: toCount(casesRows[0]?.count),
      casesPendingPayment: toCount(pendingPaymentRows[0]?.count),
      ticketsOpen: toCount(openTicketRows[0]?.count),
      sessionsActive: toCount(activeSessionRows[0]?.count),
      meetingsUpcoming: toCount(meetingsRows[0]?.count),
    },
    breakdowns: {
      caseStage: mapGroupRows(caseStageRows),
      ticketStatus: mapGroupRows(ticketStatusRows),
    },
  };

  logEvent("info", "monitoring.snapshot.generated", {
    durationMs: Date.now() - startedAt,
    database: snapshot.health.database,
    users: snapshot.counters.users,
    activeSessions: snapshot.counters.sessionsActive,
    ticketsOpen: snapshot.counters.ticketsOpen,
  });

  return snapshot;
};

