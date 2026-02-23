import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
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
    FROM Meeting
    WHERE provider = ${"amazon-chime"}
    UNION ALL
    SELECT id, caseId, scheduledAt, link, createdAt
    FROM VideoReservation
    ORDER BY createdAt DESC
  `;

  return NextResponse.json({ videos });
}
