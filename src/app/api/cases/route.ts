import { NextResponse } from "next/server";

import { createCase, listCases } from "@/server/storage";
import { authorize } from "@/server/route-auth";
import type { CaseRecord, CaseStage, ClientProfile } from "@/server/types";

export async function GET() {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  console.log("[debug][api/cases] auth", auth.session);
  if (auth.response) return auth.response;
  const cases: CaseRecord[] = await listCases();
  console.log("[debug][api/cases] total", cases.length, "role", auth.session?.effectiveRole);
  if (auth.session?.effectiveRole === "client") {
    const owned = cases.filter((item) => item.user.email === auth.session.effectiveEmail);
    console.log("[debug][api/cases] client filter", {
      email: auth.session.effectiveEmail,
      before: cases.length,
      after: owned.length,
    });
    return NextResponse.json({
      cases: owned,
    });
  }
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const auth = await authorize(["client", "admin", "super-admin"]);
  if (auth.response) return auth.response;
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
    user: {
      ...body.user,
      email: auth.session!.effectiveEmail,
    },
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
