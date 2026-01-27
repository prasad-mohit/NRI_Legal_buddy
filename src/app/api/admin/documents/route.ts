import { NextResponse } from "next/server";

import prisma from "@/server/db";

export async function GET() {
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
