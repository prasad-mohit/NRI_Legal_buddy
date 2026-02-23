import { NextResponse } from "next/server";

import {
  isValidEmailFormat,
  normalizeEmail,
  validatePasswordStrength,
} from "@/server/auth";
import { logAuthEvent } from "@/server/logger";
import { createSignupOtp } from "@/server/otp";
import { sendOtpEmail } from "@/server/mailer";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { findUserByEmail } from "@/server/users";

const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_BLOCK_MS = 20 * 60 * 1000;

// Compatibility route for older clients. This route now only starts OTP flow.
export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    country?: string;
  };

  try {
    body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      country?: string;
    };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const fullName = (body.fullName ?? "").trim();
  const country = (body.country ?? "").trim();
  const password = body.password ?? "";

  if (!email || !fullName || !country || !password) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ message: "Invalid email address" }, { status: 400 });
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ message: passwordCheck.message }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: "auth-signup-start",
    subject: getAuthRateLimitKey(req, email),
    maxAttempts: 6,
    windowMs: SIGNUP_WINDOW_MS,
    blockMs: SIGNUP_BLOCK_MS,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "auth-signup-start-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 12,
    windowMs: SIGNUP_WINDOW_MS,
    blockMs: SIGNUP_BLOCK_MS,
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

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ message: "Account already exists" }, { status: 409 });
  }

  const created = await createSignupOtp({ email, fullName, country, password });
  logAuthEvent("signup.compat_start", { email });
  try {
    await sendOtpEmail({
      to: email,
      otp: created.otp,
      purpose: "signup",
      expiresInMinutes: created.expiresInMinutes,
    });
  } catch (error) {
    logAuthEvent(
      "signup.compat_otp_email_failed",
      { email, error: error instanceof Error ? error.message : String(error) },
      "error"
    );
    return NextResponse.json({ message: "Failed to send verification code" }, { status: 502 });
  }

  return NextResponse.json({
    message: "OTP sent",
    flow: "otp-required",
    email: created.email,
    expiresInMinutes: created.expiresInMinutes,
    testOtp: process.env.NODE_ENV !== "production" ? created.otp : undefined,
  });
}
