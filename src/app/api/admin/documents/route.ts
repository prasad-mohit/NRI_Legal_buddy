import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const documents = await prisma.$queryRaw<
    Array<{
      id: string;
      caseId: string;
      name: string;
      type: string;
      status: string;
      summary: string;
      uploadedAt: string;
    }>
  >`
    SELECT id, caseId, name, type, status, summary, uploadedAt
    FROM VaultDocument
    ORDER BY uploadedAt DESC
  `;

  return NextResponse.json({ documents });
}
