import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { ensureCaseSchema } from "@/server/storage";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  console.log("[debug][api/admin/cases] auth", auth.session);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  await ensureCaseSchema();
  const cases = await prisma.$queryRaw<
    Array<{
      id: string;
      serviceId: string;
      stage: string;
      caseStatus: string | null;
      stageStatus: string | null;
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
      bankInstructions: string | null;
      paymentPlan: string | null;
      terms: string | null;
    }>
  >`
    SELECT c.id, c.serviceId, c.stage, c.caseStatus, c.stageStatus, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
      c.caseManagerMeta, c.practitionerMeta, c.documentCount, c.videoSlot, c.updatedAt,
      c.bankInstructions, c.paymentPlan, c.terms,
      u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    ORDER BY c.updatedAt DESC
  `;
  console.log("[debug][api/admin/cases] rows", cases.length, "role", auth.session?.effectiveRole);

  return NextResponse.json({ cases });
}
