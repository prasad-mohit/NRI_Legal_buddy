import { NextResponse } from "next/server";

import { requestPasswordReset } from "@/server/password-reset";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";

const RESET_START_WINDOW_MS = 15 * 60 * 1000;
const RESET_START_BLOCK_MS = 20 * 60 * 1000;

export async function POST(req: Request) {
  let body: { email?: string; newPassword?: string };
  try {
    body = (await req.json()) as { email?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (!body.email || !body.newPassword) {
    return NextResponse.json({ message: "Email and new password required" }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: "auth-reset-start",
    subject: getAuthRateLimitKey(req, body.email),
    maxAttempts: 6,
    windowMs: RESET_START_WINDOW_MS,
    blockMs: RESET_START_BLOCK_MS,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "auth-reset-start-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 12,
    windowMs: RESET_START_WINDOW_MS,
    blockMs: RESET_START_BLOCK_MS,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many reset attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many reset attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const result = await requestPasswordReset({
    email: body.email,
    newPassword: body.newPassword,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    accepted: true,
    email: result.email,
    expiresInMinutes: result.expiresInMinutes,
    testOtp: process.env.NODE_ENV !== "production" ? result.testOtp : undefined,
  });
}
