import { NextResponse } from "next/server";

import { updateCase } from "@/server/storage";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    caseId: string;
    caseManager?: {
      id: string;
      name: string;
      specialization: string;
      timezone: string;
      weeklyLoad: number;
    };
    practitioner?: {
      id: string;
      name: string;
      bar: string;
      focus: string;
    };
  };

  if (!body.caseId) {
    return NextResponse.json({ message: "Missing caseId" }, { status: 400 });
  }

  const record = await updateCase(body.caseId, {
    caseManagerId: body.caseManager?.id,
    practitionerId: body.practitioner?.id,
    caseManagerInfo: body.caseManager,
    practitionerInfo: body.practitioner,
    stage: body.practitioner ? "practitioner-assigned" : "case-manager-assigned",
  });

  return NextResponse.json({ case: record });
}
