import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  country: string;
  passwordHash: string;
  role?: string;
  isEmailVerified?: number;
  signupFeePaid?: number;
}

export const findUserByEmail = async (email: string) => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, fullName, email, country, passwordHash, role, isEmailVerified, signupFeePaid
    FROM User
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findUserPublicByEmail = async (email: string) => {
  const record = await findUserByEmail(email);
  if (!record) return null;
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    country: record.country,
    role: (record.role as "client" | "lawyer") ?? "client",
    signupFeePaid: Boolean(record.signupFeePaid),
  };
};

export const createUser = async (payload: {
  fullName: string;
  email: string;
  country: string;
  password: string;
  role?: "client" | "lawyer";
  isEmailVerified?: boolean;
}) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const id = `USER-${randomUUID()}`;
  const passwordHash = hashPassword(payload.password);

  await prisma.$executeRaw`
    INSERT INTO User (id, fullName, email, country, passwordHash, role, isEmailVerified, signupFeePaid, createdAt)
    VALUES (
      ${id},
      ${payload.fullName},
      ${email},
      ${payload.country},
      ${passwordHash},
      ${payload.role ?? "client"},
      ${payload.isEmailVerified ? 1 : 0},
      0,
      CURRENT_TIMESTAMP
    )
  `;

  return {
    id,
    fullName: payload.fullName,
    email,
    country: payload.country,
    passwordHash,
    role: payload.role ?? "client",
  };
};

export const createUserWithPasswordHash = async (payload: {
  fullName: string;
  email: string;
  country: string;
  passwordHash: string;
  role?: "client" | "lawyer";
}) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(payload.email);
  const id = `USER-${randomUUID()}`;

  await prisma.$executeRaw`
    INSERT INTO User (id, fullName, email, country, passwordHash, role, isEmailVerified, signupFeePaid, createdAt)
    VALUES (
      ${id},
      ${payload.fullName},
      ${email},
      ${payload.country},
      ${payload.passwordHash},
      ${payload.role ?? "client"},
      1,
      0,
      CURRENT_TIMESTAMP
    )
  `;

  return { id, email, fullName: payload.fullName, country: payload.country, role: payload.role ?? "client" };
};

export const verifyUserLogin = async (email: string, password: string) => {
  await ensureRuntimeSchema();
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (user.isEmailVerified === 0) return null;
  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    role: (user.role as "client" | "lawyer") ?? "client",
    signupFeePaid: Boolean(user.signupFeePaid),
  };
};

export const updateUserPasswordHashByEmail = async (params: {
  email: string;
  passwordHash: string;
}) => {
  await ensureRuntimeSchema();
  const email = normalizeEmail(params.email);
  const result = await prisma.$executeRaw`
    UPDATE User
    SET passwordHash = ${params.passwordHash}
    WHERE email = ${email}
  `;
  return Number(result) > 0;
};
