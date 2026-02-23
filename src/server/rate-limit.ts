import { createHash } from "crypto";

import prisma from "@/server/db";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

interface AuthRateLimitRow {
  id: string;
  attempts: number;
  windowStart: string;
  blockedUntil: string | null;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const hashSubject = (subject: string) =>
  createHash("sha256").update(subject).digest("hex");

export const consumeRateLimit = async (payload: {
  bucket: string;
  subject: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
}): Promise<RateLimitDecision> => {
  await ensureRuntimeSchema();

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const id = `${payload.bucket}:${hashSubject(payload.subject)}`;

  const rows = await prisma.$queryRaw<AuthRateLimitRow[]>`
    SELECT id, attempts, windowStart, blockedUntil
    FROM AuthRateLimit
    WHERE id = ${id}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    await prisma.$executeRaw`
      INSERT INTO AuthRateLimit (id, bucket, subjectHash, attempts, windowStart, blockedUntil, createdAt, updatedAt)
      VALUES (
        ${id},
        ${payload.bucket},
        ${hashSubject(payload.subject)},
        1,
        ${nowIso},
        ${null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    return {
      allowed: true,
      remaining: Math.max(0, payload.maxAttempts - 1),
      retryAfterSeconds: 0,
    };
  }

  const blockedUntilMs = row.blockedUntil ? new Date(row.blockedUntil).getTime() : 0;
  if (blockedUntilMs > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - now) / 1000)),
    };
  }

  const windowStartMs = new Date(row.windowStart).getTime();
  const windowExpired = Number.isNaN(windowStartMs) || now - windowStartMs >= payload.windowMs;
  const nextAttempts = windowExpired ? 1 : row.attempts + 1;

  if (nextAttempts > payload.maxAttempts) {
    const blockedUntil = new Date(now + payload.blockMs).toISOString();
    await prisma.$executeRaw`
      UPDATE AuthRateLimit
      SET attempts = ${nextAttempts},
          windowStart = ${windowExpired ? nowIso : row.windowStart},
          blockedUntil = ${blockedUntil},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(payload.blockMs / 1000)),
    };
  }

  await prisma.$executeRaw`
    UPDATE AuthRateLimit
    SET attempts = ${nextAttempts},
        windowStart = ${windowExpired ? nowIso : row.windowStart},
        blockedUntil = ${null},
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;

  return {
    allowed: true,
    remaining: Math.max(0, payload.maxAttempts - nextAttempts),
    retryAfterSeconds: 0,
  };
};
