import { NextResponse } from "next/server";

import { updateCase } from "@/server/storage";

export async function POST(req: Request) {
  const body = (await req.json()) as { caseId: string };
  if (!body.caseId) {
    return NextResponse.json({ message: "Missing caseId" }, { status: 400 });
  }

  const record = await updateCase(body.caseId, {
    paymentStatus: "approved",
    platformFeePaid: true,
    stage: "case-manager-assigned",
  });

  return NextResponse.json({ case: record });
}
