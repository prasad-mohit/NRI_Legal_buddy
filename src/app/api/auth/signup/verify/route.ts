import { NextResponse } from "next/server";

import { normalizeEmail } from "@/server/auth";
import { logAuthEvent } from "@/server/logger";
import { consumeSignupOtp } from "@/server/otp";
import { getAuthRateLimitKey, getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { createSession } from "@/server/session";
import { createUserWithPasswordHash, findUserByEmail } from "@/server/users";

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_BLOCK_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  let body: { email?: string; otp?: string };
  try {
    body = (await req.json()) as { email?: string; otp?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const otp = (body.otp ?? "").trim();

  if (!email || !otp) {
    return NextResponse.json({ message: "Missing email or OTP" }, { status: 400 });
  }

  const limit = await consumeRateLimit({
    bucket: "auth-signup-verify",
    subject: getAuthRateLimitKey(req, email),
    maxAttempts: 8,
    windowMs: VERIFY_WINDOW_MS,
    blockMs: VERIFY_BLOCK_MS,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "auth-signup-verify-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 20,
    windowMs: VERIFY_WINDOW_MS,
    blockMs: VERIFY_BLOCK_MS,
  });

  if (!limit.allowed) {
    logAuthEvent("signup_verify.rate_limited", { email, retryAfterSeconds: limit.retryAfterSeconds }, "warn");
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  if (!ipLimit.allowed) {
    logAuthEvent("signup_verify.ip_rate_limited", { email, retryAfterSeconds: ipLimit.retryAfterSeconds }, "warn");
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const consumed = await consumeSignupOtp({ email, otp });
  if (!consumed) {
    logAuthEvent("signup_verify.invalid_otp", { email }, "warn");
    return NextResponse.json({ message: "Invalid or expired OTP" }, { status: 400 });
  }

  const existing = await findUserByEmail(consumed.email);
  const user =
    existing ??
    (await createUserWithPasswordHash({
      fullName: consumed.fullName,
      email: consumed.email,
      country: consumed.country,
      passwordHash: consumed.passwordHash,
      role: "client",
    }));
  const resolvedRole =
    ((existing?.role as "client" | "lawyer" | undefined) ?? user.role ?? "client");

  await createSession(
    {
      subjectId: user.id,
      subjectEmail: user.email,
      role: resolvedRole,
    },
    req
  );

  logAuthEvent("signup_verify.completed", { email: user.email, role: resolvedRole });
  return NextResponse.json({
    user: {
      fullName: user.fullName,
      email: user.email,
      country: user.country,
      role: resolvedRole,
    },
  });
}
