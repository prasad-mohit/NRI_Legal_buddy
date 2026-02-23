import { NextResponse } from "next/server";

import { logAction } from "@/server/audit-log";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { updateCase } from "@/server/storage";

export async function POST(req: Request) {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
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

  let record;
  try {
    record = await updateCase(body.caseId, {
      caseManagerId: body.caseManager?.id,
      practitionerId: body.practitioner?.id,
      caseManagerInfo: body.caseManager,
      practitionerInfo: body.practitioner,
      stage: body.practitioner ? "practitioner-assigned" : "case-manager-assigned",
      caseStatus: body.practitioner ? "AWAITING_CLIENT_APPROVAL" : "UNDER_REVIEW",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Illegal state transition";
    if (message.includes("Illegal")) {
      return NextResponse.json({ message }, { status: 403 });
    }
    throw error;
  }

  await logAction({
    caseId: body.caseId,
    action: "assignment.updated",
    userId: auth.session!.effectiveEmail,
    role: auth.session!.effectiveRole,
    details: {
      caseManagerId: body.caseManager?.id,
      practitionerId: body.practitioner?.id,
    },
  });

  return NextResponse.json({ case: record });
}
