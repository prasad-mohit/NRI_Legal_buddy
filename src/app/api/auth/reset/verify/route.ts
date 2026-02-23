import { NextResponse } from "next/server";

import { confirmPasswordReset } from "@/server/password-reset";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";

const RESET_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const RESET_VERIFY_BLOCK_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  let body: { email?: string; otp?: string };
  try {
    body = (await req.json()) as { email?: string; otp?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (!body.email || !body.otp) {
    return NextResponse.json({ message: "Email and OTP required" }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: "auth-reset-verify",
    subject: getAuthRateLimitKey(req, body.email),
    maxAttempts: 8,
    windowMs: RESET_VERIFY_WINDOW_MS,
    blockMs: RESET_VERIFY_BLOCK_MS,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "auth-reset-verify-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 20,
    windowMs: RESET_VERIFY_WINDOW_MS,
    blockMs: RESET_VERIFY_BLOCK_MS,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many OTP attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many OTP attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const result = await confirmPasswordReset({
    email: body.email,
    otp: body.otp,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
