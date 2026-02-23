import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";

import prisma from "@/server/db";
import { logAuthEvent } from "@/server/logger";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

export const SESSION_COOKIE_NAME = "nri_session";
const SESSION_DAYS = 14;
const SESSION_RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface SessionRow {
  id: string;
  tokenHash: string;
  subjectId: string;
  subjectEmail: string;
  role: string;
  actingAsRole: string | null;
  actingAsEmail: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuthSession {
  id: string;
  subjectId: string;
  email: string;
  role: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: string;
  actingAsRole?: string;
  actingAsEmail?: string;
}

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const getExpiryDate = () =>
  new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

const parseCookie = (raw: string | undefined) => {
  if (!raw) return null;
  const [id, token] = raw.split(".");
  if (!id || !token) return null;
  return { id, token };
};

const getHeader = (name: string, req?: Request) =>
  req?.headers.get(name) ?? headers().get(name);

const getRequestIp = (req?: Request) => {
  const forwarded = getHeader("x-forwarded-for", req);
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return getHeader("x-real-ip", req) ?? "unknown";
};

const setSessionCookie = (sessionId: string, token: string, expiresAt: Date) => {
  const forwardedProto = headers().get("x-forwarded-proto") || "";
  const isHttps = forwardedProto.includes("https");
  cookies().set(SESSION_COOKIE_NAME, `${sessionId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
};

const revokeSessionByCookie = async (parsed: { id: string; token: string }) => {
  await prisma.$executeRaw`
    UPDATE Session
    SET revokedAt = CURRENT_TIMESTAMP
    WHERE id = ${parsed.id}
      AND tokenHash = ${hashToken(parsed.token)}
      AND revokedAt IS NULL
  `;
};

const maybeRenewSession = async (row: SessionRow, token: string) => {
  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return;
  if (expiresAtMs - Date.now() > SESSION_RENEW_THRESHOLD_MS) return;

  const nextExpiry = getExpiryDate();
  await prisma.$executeRaw`
    UPDATE Session
    SET expiresAt = ${nextExpiry.toISOString()}
    WHERE id = ${row.id}
      AND revokedAt IS NULL
  `;
  setSessionCookie(row.id, token, nextExpiry);
};

export const createSession = async (
  payload: {
    subjectId: string;
    subjectEmail: string;
    role: string;
  },
  req?: Request
) => {
  await ensureRuntimeSchema();

  const currentCookie = parseCookie(cookies().get(SESSION_COOKIE_NAME)?.value);
  if (currentCookie) {
    await revokeSessionByCookie(currentCookie);
  }

  const id = `SES-${randomUUID()}`;
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiry = getExpiryDate();

  await prisma.$executeRaw`
    INSERT INTO Session (
      id, tokenHash, subjectId, subjectEmail, role,
      userAgent, ipAddress, expiresAt, createdAt
    )
    VALUES (
      ${id},
      ${tokenHash},
      ${payload.subjectId},
      ${payload.subjectEmail},
      ${payload.role},
      ${getHeader("user-agent", req)},
      ${getRequestIp(req)},
      ${expiry.toISOString()},
      CURRENT_TIMESTAMP
    )
  `;

  setSessionCookie(id, token, expiry);
  logAuthEvent("session.created", {
    sessionId: id,
    subjectId: payload.subjectId,
    role: payload.role,
    email: payload.subjectEmail,
  });
};

export const clearSession = async (req?: Request) => {
  await ensureRuntimeSchema();
  const parsed = parseCookie(cookies().get(SESSION_COOKIE_NAME)?.value);
  if (parsed) {
    await revokeSessionByCookie(parsed);
    logAuthEvent("session.cleared", {
      sessionId: parsed.id,
      ipAddress: getRequestIp(req),
    });
  }
  cookies().delete(SESSION_COOKIE_NAME);
};

export const revokeSessionsByEmail = async (email: string) => {
  await ensureRuntimeSchema();
  await prisma.$executeRaw`
    UPDATE Session
    SET revokedAt = CURRENT_TIMESTAMP
    WHERE subjectEmail = ${email.toLowerCase()}
      AND revokedAt IS NULL
  `;
  logAuthEvent("session.revoked_by_email", { email });
};

export const getSession = async (): Promise<AuthSession | null> => {
  await ensureRuntimeSchema();
  const parsed = parseCookie(cookies().get(SESSION_COOKIE_NAME)?.value);
  if (!parsed) return null;

  const rows = await prisma.$queryRaw<SessionRow[]>`
    SELECT id, tokenHash, subjectId, subjectEmail, role, actingAsRole, actingAsEmail,
           userAgent, ipAddress, expiresAt, revokedAt
    FROM Session
    WHERE id = ${parsed.id}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || row.revokedAt) {
    cookies().delete(SESSION_COOKIE_NAME);
    return null;
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await prisma.$executeRaw`
      UPDATE Session
      SET revokedAt = CURRENT_TIMESTAMP
      WHERE id = ${row.id}
        AND revokedAt IS NULL
    `;
    cookies().delete(SESSION_COOKIE_NAME);
    return null;
  }

  if (row.tokenHash !== hashToken(parsed.token)) {
    cookies().delete(SESSION_COOKIE_NAME);
    logAuthEvent("session.token_mismatch", { sessionId: row.id }, "warn");
    return null;
  }

  await maybeRenewSession(row, parsed.token);

  return {
    id: row.id,
    subjectId: row.subjectId,
    email: row.subjectEmail,
    role: row.role,
    userAgent: row.userAgent ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
    expiresAt: row.expiresAt,
    actingAsRole: row.actingAsRole ?? undefined,
    actingAsEmail: row.actingAsEmail ?? undefined,
  };
};

export const requireRole = async (roles: string[]) => {
  const session = await getSession();
  if (!session) return null;
  const role = session.actingAsRole ?? session.role;
  if (!roles.includes(role)) return null;
  return {
    ...session,
    effectiveRole: role,
    effectiveEmail: session.actingAsEmail ?? session.email,
  };
};

export const impersonateSession = async (actingAs: {
  role: string;
  email: string;
}) => {
  const parsed = parseCookie(cookies().get(SESSION_COOKIE_NAME)?.value);
  if (!parsed) return;
  await prisma.$executeRaw`
    UPDATE Session
    SET actingAsRole = ${actingAs.role},
        actingAsEmail = ${actingAs.email}
    WHERE id = ${parsed.id}
      AND revokedAt IS NULL
  `;
  logAuthEvent("session.impersonation", {
    sessionId: parsed.id,
    actingAsRole: actingAs.role,
    actingAsEmail: actingAs.email,
  });
};
