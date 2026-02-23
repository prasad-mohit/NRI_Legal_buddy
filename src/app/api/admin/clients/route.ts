import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const clients = await prisma.$queryRaw<
    Array<{
      id: string;
      fullName: string;
      email: string;
      country: string;
      createdAt: string;
    }>
  >`
    SELECT id, fullName, email, country, createdAt
    FROM User
    ORDER BY createdAt DESC
  `;

  return NextResponse.json({ clients });
}
