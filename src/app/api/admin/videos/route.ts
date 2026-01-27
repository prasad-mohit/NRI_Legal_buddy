import { NextResponse } from "next/server";

import prisma from "@/server/db";

export async function GET() {
  const videos = await prisma.$queryRaw<
    Array<{
      id: string;
      caseId: string;
      scheduledAt: string;
      link: string;
      createdAt: string;
    }>
  >`
    SELECT id, caseId, scheduledAt, link, createdAt
    FROM VideoReservation
    ORDER BY createdAt DESC
  `;

  return NextResponse.json({ videos });
}
