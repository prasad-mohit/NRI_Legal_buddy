import { NextResponse } from "next/server";

import { verifyAdminLogin } from "@/server/admin";
import { logAuthEvent } from "@/server/logger";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { createSession } from "@/server/session";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: "admin-login",
    subject: getAuthRateLimitKey(req, body.email),
    maxAttempts: 6,
    windowMs: 10 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "admin-login-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 20,
    windowMs: 10 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const session = await verifyAdminLogin(body.email, body.password);
  if (!session) {
    logAuthEvent("admin_login.invalid_credentials", { email: body.email.toLowerCase() }, "warn");
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
  await createSession({
    subjectId: session.id,
    subjectEmail: session.email,
    role: session.role || "admin",
  }, req);

  logAuthEvent("admin_login.success", { email: session.email, role: session.role });

  return NextResponse.json({ session });
}
