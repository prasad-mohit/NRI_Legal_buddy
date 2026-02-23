import { NextResponse } from "next/server";

import { confirmPasswordReset, requestPasswordReset } from "@/server/password-reset";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";

const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_BLOCK_MS = 20 * 60 * 1000;

// Compatibility route:
// - POST { email, newPassword } -> request OTP
// - POST { email, otp } -> confirm reset
export async function POST(req: Request) {
  let body: { email?: string; newPassword?: string; otp?: string };
  try {
    body = (await req.json()) as { email?: string; newPassword?: string; otp?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ message: "Email required" }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: body.otp ? "auth-reset-verify" : "auth-reset-start",
    subject: getAuthRateLimitKey(req, body.email),
    maxAttempts: body.otp ? 8 : 6,
    windowMs: RESET_WINDOW_MS,
    blockMs: RESET_BLOCK_MS,
  });
  const ipLimit = await consumeRateLimit({
    bucket: body.otp ? "auth-reset-verify-ip" : "auth-reset-start-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: body.otp ? 20 : 12,
    windowMs: RESET_WINDOW_MS,
    blockMs: RESET_BLOCK_MS,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  if (body.otp) {
    const result = await confirmPasswordReset({
      email: body.email,
      otp: body.otp,
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.newPassword) {
    return NextResponse.json({ message: "newPassword required" }, { status: 400 });
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
