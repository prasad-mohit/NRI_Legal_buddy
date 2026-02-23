import { createHash, randomInt } from "crypto";

import prisma from "@/server/db";
import { hashPassword, normalizeEmail } from "@/server/auth";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

const OTP_TTL_MINUTES = 10;

const hashOtp = (otp: string) =>
  createHash("sha256").update(otp).digest("hex");

const generateOtp = () => String(randomInt(100000, 999999));

const getOtpExpiry = () =>
  new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

export const createSignupOtp = async (payload: {
  email: string;
  fullName: string;
  country: string;
  password: string;
}) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const otp = generateOtp();
  const id = `OTP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = hashPassword(payload.password);
  const otpHash = hashOtp(otp);

  // Only the latest OTP is valid for each email.
  await prisma.$executeRaw`
    UPDATE EmailOtp
    SET consumedAt = CURRENT_TIMESTAMP
    WHERE email = ${email} AND consumedAt IS NULL
  `;

  await prisma.$executeRaw`
    INSERT INTO EmailOtp (
      id, email, fullName, country, passwordHash, otpHash, expiresAt, createdAt
    )
    VALUES (
      ${id}, ${email}, ${payload.fullName}, ${payload.country},
      ${passwordHash}, ${otpHash}, ${getOtpExpiry()}, CURRENT_TIMESTAMP
    )
  `;

  return {
    otp,
    id,
    email,
    expiresInMinutes: OTP_TTL_MINUTES,
  };
};

export const consumeSignupOtp = async (payload: { email: string; otp: string }) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      fullName: string;
      country: string;
      passwordHash: string;
      otpHash: string;
      expiresAt: string;
      consumedAt: string | null;
    }>
  >`
    SELECT id, email, fullName, country, passwordHash, otpHash, expiresAt, consumedAt
    FROM EmailOtp
    WHERE email = ${email}
    ORDER BY createdAt DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.consumedAt) {
    return null;
  }
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return null;
  }
  if (row.otpHash !== hashOtp(payload.otp)) {
    return null;
  }

  await prisma.$executeRaw`
    UPDATE EmailOtp SET consumedAt = CURRENT_TIMESTAMP WHERE id = ${row.id}
  `;

  return {
    email: row.email,
    fullName: row.fullName,
    country: row.country,
    passwordHash: row.passwordHash,
  };
};

export const createPasswordResetOtp = async (payload: {
  email: string;
  newPassword: string;
}) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const otp = generateOtp();
  const id = `RST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = hashPassword(payload.newPassword);

  await prisma.$executeRaw`
    UPDATE PasswordResetOtp
    SET consumedAt = CURRENT_TIMESTAMP
    WHERE email = ${email} AND consumedAt IS NULL
  `;

  await prisma.$executeRaw`
    INSERT INTO PasswordResetOtp (
      id, email, passwordHash, otpHash, expiresAt, createdAt
    )
    VALUES (
      ${id}, ${email}, ${passwordHash}, ${hashOtp(otp)}, ${getOtpExpiry()}, CURRENT_TIMESTAMP
    )
  `;

  return {
    email,
    otp,
    expiresInMinutes: OTP_TTL_MINUTES,
  };
};

export const consumePasswordResetOtp = async (payload: { email: string; otp: string }) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      passwordHash: string;
      otpHash: string;
      expiresAt: string;
      consumedAt: string | null;
    }>
  >`
    SELECT id, email, passwordHash, otpHash, expiresAt, consumedAt
    FROM PasswordResetOtp
    WHERE email = ${email}
    ORDER BY createdAt DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || row.consumedAt) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
  if (row.otpHash !== hashOtp(payload.otp)) return null;

  await prisma.$executeRaw`
    UPDATE PasswordResetOtp
    SET consumedAt = CURRENT_TIMESTAMP
    WHERE id = ${row.id}
  `;

  return {
    email: row.email,
    passwordHash: row.passwordHash,
  };
};
