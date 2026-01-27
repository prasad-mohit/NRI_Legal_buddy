import { NextResponse } from "next/server";

import prisma from "@/server/db";

export async function GET() {
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
