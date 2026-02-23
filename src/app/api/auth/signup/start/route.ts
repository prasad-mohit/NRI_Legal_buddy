import { NextResponse } from "next/server";

import {
  isValidEmailFormat,
  normalizeEmail,
  validatePasswordStrength,
} from "@/server/auth";
import { logAuthEvent } from "@/server/logger";
import { createSignupOtp } from "@/server/otp";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { findUserByEmail } from "@/server/users";
import { sendOtpEmail } from "@/server/mailer";

const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_BLOCK_MS = 20 * 60 * 1000;

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
    logAuthEvent("signup_start.rate_limited", { email, retryAfterSeconds: limit.retryAfterSeconds }, "warn");
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    logAuthEvent("signup_start.ip_rate_limited", { email, retryAfterSeconds: ipLimit.retryAfterSeconds }, "warn");
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
    logAuthEvent("signup_start.existing_account", { email }, "warn");
    return NextResponse.json({ message: "Account already exists" }, { status: 409 });
  }

  const otp = await createSignupOtp({
    email,
    fullName,
    country,
    password,
  });

  logAuthEvent("signup_start.otp_created", { email });
  try {
    await sendOtpEmail({
      to: email,
      otp: otp.otp,
      purpose: "signup",
      expiresInMinutes: otp.expiresInMinutes,
    });
  } catch (error) {
    logAuthEvent(
      "signup_start.otp_email_failed",
      { email, error: error instanceof Error ? error.message : String(error) },
      "error"
    );
    return NextResponse.json({ message: "Failed to send verification code" }, { status: 502 });
  }
  return NextResponse.json({
    email: otp.email,
    expiresInMinutes: otp.expiresInMinutes,
    testOtp: process.env.NODE_ENV !== "production" ? otp.otp : undefined,
  });
}
