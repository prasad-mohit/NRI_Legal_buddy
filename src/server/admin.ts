import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth";

interface AdminRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordHash: string;
  createdAt: string;
}

export const createAdminUser = async (params: {
  email: string;
  displayName: string;
  role: string;
  password: string;
}) => {
  const email = normalizeEmail(params.email);
  const passwordHash = hashPassword(params.password);
  const id = `ADMIN-${randomUUID()}`;

  await prisma.$executeRaw`
    INSERT INTO AdminUser (id, email, displayName, role, passwordHash, createdAt)
    VALUES (${id}, ${email}, ${params.displayName}, ${params.role}, ${passwordHash}, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      displayName = ${params.displayName},
      role = ${params.role},
      passwordHash = ${passwordHash}
  `;

  return { id, email, displayName: params.displayName, role: params.role };
};

export const listAdminUsers = async () => {
  const rows = await prisma.$queryRaw<AdminRow[]>`
    SELECT id, email, displayName, role, createdAt
    FROM AdminUser
    ORDER BY createdAt DESC
  `;
  return rows;
};

export const verifyAdminLogin = async (email: string, password: string) => {
  const rows = await prisma.$queryRaw<AdminRow[]>`
    SELECT id, email, displayName, role, passwordHash
    FROM AdminUser
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  const record = rows[0];
  if (!record) return null;
  const ok = verifyPassword(password, record.passwordHash);
  if (!ok) return null;
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    role: record.role,
  };
};
