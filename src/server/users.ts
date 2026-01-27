import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  country: string;
  passwordHash: string;
}

export const findUserByEmail = async (email: string) => {
  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, fullName, email, country, passwordHash
    FROM User
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const createUser = async (payload: {
  fullName: string;
  email: string;
  country: string;
  password: string;
}) => {
  const email = normalizeEmail(payload.email);
  const id = `USER-${randomUUID()}`;
  const passwordHash = hashPassword(payload.password);

  await prisma.$executeRaw`
    INSERT INTO User (id, fullName, email, country, passwordHash, createdAt)
    VALUES (${id}, ${payload.fullName}, ${email}, ${payload.country}, ${passwordHash}, CURRENT_TIMESTAMP)
  `;

  return { id, fullName: payload.fullName, email, country: payload.country, passwordHash };
};

export const verifyUserLogin = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    role: "client" as const,
  };
};
