import { NextResponse } from "next/server";

import prisma from "@/server/db";

export async function GET() {
  const cases = await prisma.$queryRaw<
    Array<{
      id: string;
      serviceId: string;
      stage: string;
      platformFeePaid: number;
      paymentStatus: string;
  caseDetails: string | null;
      caseSummary: string | null;
  caseManagerMeta: string | null;
  practitionerMeta: string | null;
      documentCount: number;
      videoSlot: string | null;
      updatedAt: string;
      fullName: string;
      email: string;
      country: string;
    }>
  >`
    SELECT c.id, c.serviceId, c.stage, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
      c.caseManagerMeta, c.practitionerMeta, c.documentCount, c.videoSlot, c.updatedAt,
      u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    ORDER BY c.updatedAt DESC
  `;

  return NextResponse.json({ cases });
}
