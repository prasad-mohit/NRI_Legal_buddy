import { NextResponse } from "next/server";

import { createCase, listCases } from "@/server/storage";
import type { CaseStage, ClientProfile } from "@/server/types";

export async function GET() {
  const cases = await listCases();
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    user: ClientProfile;
    serviceId: string;
    stage: CaseStage;
    platformFeePaid: boolean;
    paymentStatus?: "pending" | "approved";
    caseDetails?: string;
    timeline: Array<{
      id: string;
      title: string;
      description: string;
      actor: string;
      timestamp: string;
    }>;
    escrowMilestones: Array<{ id: string; unlocked: boolean }>;
  };

  const record = await createCase({
    user: body.user,
    serviceId: body.serviceId,
    stage: body.stage,
    platformFeePaid: body.platformFeePaid,
    paymentStatus: body.paymentStatus,
    caseDetails: body.caseDetails,
    timeline: body.timeline,
    escrowMilestones: body.escrowMilestones,
  });

  return NextResponse.json(record, { status: 201 });
}
