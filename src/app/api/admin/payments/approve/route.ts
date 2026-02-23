import { NextResponse } from "next/server";

import { normalizeCaseStatus, normalizeStageStatus, validateCaseTransition, validateStageTransition } from "@/core/stateMachine";
import { logAction } from "@/server/audit-log";
import prisma from "@/server/db";
import { checkRole, checkCaseState, checkStageState } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { getCase } from "@/server/storage";

export async function POST(req: Request) {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json()) as { caseId: string };
  if (!body.caseId) {
    return NextResponse.json({ message: "Missing caseId" }, { status: 400 });
  }

  const state = await checkCaseState(body.caseId, ["PAYMENT_PENDING"]);
  if (state.response) return state.response;
  const stageState = await checkStageState(body.caseId, [
    "AWAITING_PAYMENT",
    "PAYMENT_SUBMITTED",
    "PAID",
  ]);
  if (stageState.response) return stageState.response;
  const current = state.record ?? stageState.record;
  const currentCaseStatus = normalizeCaseStatus(current?.caseStatus as any);
  const currentStageStatus = normalizeStageStatus(current?.stageStatus as any);
  const nextCaseStatus = "IN_PROGRESS";
  const nextStageStatus = "PAID";

  validateCaseTransition(currentCaseStatus, nextCaseStatus);
  validateStageTransition(currentStageStatus, nextStageStatus);

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: body.caseId },
      data: {
        paymentStatus: "approved",
        platformFeePaid: true,
        stageStatus: nextStageStatus,
        caseStatus: nextCaseStatus,
        stage: current.stage ?? "case-manager-assigned",
      },
    });
  });

  const record = await getCase(body.caseId);

  await logAction({
    caseId: body.caseId,
    action: "payment.approved",
    userId: auth.session!.effectiveEmail,
    role: auth.session!.effectiveRole,
    details: {
      previousCaseStatus: currentCaseStatus,
      previousStageStatus: currentStageStatus,
    },
  });

  return NextResponse.json({ case: record });
}
