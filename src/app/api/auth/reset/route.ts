import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { hashPassword, normalizeEmail } from "@/server/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; newPassword?: string };

  if (!body.email || !body.newPassword) {
    return NextResponse.json({ message: "Email and new password required" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const passwordHash = hashPassword(body.newPassword);

  const userResult = await prisma.$executeRaw`
    UPDATE User
    SET passwordHash = ${passwordHash}
    WHERE email = ${email}
  `;

  const adminResult = await prisma.$executeRaw`
    UPDATE AdminUser
    SET passwordHash = ${passwordHash}
    WHERE email = ${email}
  `;

  if (!userResult && !adminResult) {
    return NextResponse.json({ message: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
