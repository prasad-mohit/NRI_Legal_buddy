import { NextResponse } from "next/server";

import { verifyAdminLogin } from "@/server/admin";
import { isValidEmailFormat, normalizeEmail } from "@/server/auth";
import { logAuthEvent } from "@/server/logger";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { createSession } from "@/server/session";
import { verifyUserLogin } from "@/server/users";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!email || !password || !isValidEmailFormat(email)) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  const rateLimitKey = getAuthRateLimitKey(req, email);
  const ipLimit = await consumeRateLimit({
    bucket: "auth-login-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 25,
    windowMs: LOGIN_WINDOW_MS,
    blockMs: LOGIN_BLOCK_MS,
  });
  if (!ipLimit.allowed) {
    logAuthEvent("login.ip_rate_limited", {
      email,
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    }, "warn");
    return NextResponse.json(
      { message: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimit.retryAfterSeconds),
        },
      }
    );
  }

  const limit = await consumeRateLimit({
    bucket: "auth-login",
    subject: rateLimitKey,
    maxAttempts: 6,
    windowMs: LOGIN_WINDOW_MS,
    blockMs: LOGIN_BLOCK_MS,
  });

  if (!limit.allowed) {
    logAuthEvent("login.rate_limited", { email, retryAfterSeconds: limit.retryAfterSeconds }, "warn");
    return NextResponse.json(
      { message: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      }
    );
  }

  const adminSession = await verifyAdminLogin(email, password);
  if (adminSession) {
    await createSession(
      {
        subjectId: adminSession.id,
        subjectEmail: adminSession.email,
        role: adminSession.role || "admin",
      },
      req
    );
    logAuthEvent("login.success_admin", { email, role: adminSession.role });
    return NextResponse.json({
      user: {
        fullName: adminSession.displayName,
        email: adminSession.email,
        country: "Administrator",
        role: adminSession.role || "admin",
      },
    });
  }

  const user = await verifyUserLogin(email, password);
  if (!user) {
    logAuthEvent("login.invalid_credentials", { email }, "warn");
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  await createSession(
    {
      subjectId: user.id,
      subjectEmail: user.email,
      role: user.role,
    },
    req
  );

  logAuthEvent("login.success_user", { email, role: user.role });
  return NextResponse.json({ user });
}
