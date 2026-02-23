import { NextResponse } from "next/server";

import { normalizeStageStatus } from "@/core/stateMachine";
import { checkCaseState, checkStageState } from "@/server/guards";
import { logAction } from "@/server/audit-log";
import { advanceEscrow, addDocument, logTimelineEntry, recordVideo, updateCase } from "@/server/storage";
import { authorize } from "@/server/route-auth";
import type { CaseStage } from "@/server/types";

const summarizeCase = (details: string) => {
  const trimmed = details.trim();
  if (!trimmed) return "";
  const sentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  return sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;
};

interface TimelineInput {
  id: string;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  status?: "done" | "live" | "upcoming";
}

export async function GET(_: Request, { params }: { params: { caseId: string } }) {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  console.log("[debug][api/cases/:id] auth", auth.session);
  if (auth.response) return auth.response;
  const caseState = await checkCaseState(params.caseId, [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_APPROVAL",
    "PAYMENT_PENDING",
    "IN_PROGRESS",
    "CLOSED",
  ]);
  if (caseState.response) return caseState.response;
  const record = caseState.record!;
  console.log("[debug][api/cases/:id] fetch", params.caseId, "found", Boolean(record));
  if (
    auth.session?.effectiveRole === "client" &&
    record.user.email !== auth.session.effectiveEmail
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const stageStatus = normalizeStageStatus(record.stageStatus as any);
  const isLawyer = auth.session!.effectiveRole === "lawyer";
  if (isLawyer && (body.document || body.escrowAdvance)) {
    if (stageStatus !== "PAID") {
      return NextResponse.json(
        { message: "Stage execution locked until payment is marked PAID" },
        { status: 403 }
      );
    }
  }
  return NextResponse.json(record);
}

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  const auth = await authorize(["client", "lawyer", "admin", "super-admin"]);
  if (auth.response) return auth.response;
  const body = (await req.json()) as Partial<{
    stage: CaseStage;
    platformFeePaid: boolean;
    paymentStatus: "pending" | "approved";
    caseDetails: string;
    caseManagerId: string;
    practitionerId: string;
    caseManagerInfo: {
      id: string;
      name: string;
      specialization: string;
      timezone: string;
      weeklyLoad: number;
    };
    practitionerInfo: {
      id: string;
      name: string;
      bar: string;
      focus: string;
    };
    timelineEntry: TimelineInput;
    videoSlot: string;
    escrowAdvance: boolean;
    document: {
      name: string;
      type: string;
      status: "processing" | "ready";
      summary: string;
    };
    bankInstructions: string;
    paymentPlan: string;
    terms: string;
    paymentProof: { url?: string; note?: string };
  }>;

  const caseState = await checkCaseState(params.caseId, [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_APPROVAL",
    "PAYMENT_PENDING",
    "IN_PROGRESS",
    "CLOSED",
  ]);
  if (caseState.response) return caseState.response;
  let record = caseState.record!;
  if (
    auth.session?.effectiveRole === "client" &&
    record.user.email !== auth.session.effectiveEmail
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const isLawyer = auth.session!.effectiveRole === "lawyer";
  if (isLawyer && (body.document || body.escrowAdvance)) {
    const stageState = await checkStageState(params.caseId, ["PAID"]);
    if (stageState.response) return stageState.response;
    record = stageState.record ?? record;
  }

  const executionRequested = Boolean(body.document || body.videoSlot || body.escrowAdvance);
  if (executionRequested) {
    const progressGuard = await checkCaseState(params.caseId, ["IN_PROGRESS"]);
    if (progressGuard.response) return progressGuard.response;
    record = progressGuard.record ?? record;
  }

  if (body.timelineEntry) {
    record = await logTimelineEntry(params.caseId, body.timelineEntry);
  }

  if (body.videoSlot) {
    const { caseRecord } = await recordVideo(params.caseId, body.videoSlot);
    record = caseRecord;
  }

  if (body.document) {
    await addDocument(params.caseId, body.document);
    await logAction({
      caseId: params.caseId,
      action: "document.uploaded",
      userId: auth.session!.effectiveEmail,
      role: auth.session!.effectiveRole,
    });
  }

  if (body.paymentProof) {
    const proofEntry = {
      id: `proof-${Date.now()}`,
      submittedBy: auth.session!.effectiveEmail,
      submittedAt: new Date().toISOString(),
      url: body.paymentProof.url,
      note: body.paymentProof.note,
      approved: false,
    };
    const existingProofs = record.paymentProofs ?? [];
    try {
      record = await updateCase(params.caseId, {
        paymentProofs: [...existingProofs, proofEntry],
        stageStatus: "PAYMENT_SUBMITTED",
        caseStatus: "PAYMENT_PENDING",
        timeline: [
          ...record.timeline,
          {
            id: `evt-proof-${Date.now()}`,
            title: "Payment proof submitted",
            description: body.paymentProof.note ?? body.paymentProof.url ?? "Proof added",
            actor: auth.session!.effectiveEmail,
            timestamp: new Date().toISOString(),
            status: "live",
          },
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Illegal state transition";
      if (message.includes("Illegal")) {
        return NextResponse.json({ message }, { status: 403 });
      }
      throw error;
    }
    await logAction({
      caseId: params.caseId,
      action: "payment.proof_submitted",
      userId: auth.session!.effectiveEmail,
      role: auth.session!.effectiveRole,
    });
  }

  if (body.escrowAdvance) {
    record = await advanceEscrow(params.caseId);
    await logAction({
      caseId: params.caseId,
      action: "stage.advanced",
      userId: auth.session!.effectiveEmail,
      role: auth.session!.effectiveRole,
    });
  }

  if (body.caseDetails) {
    try {
      record = await updateCase(params.caseId, {
        caseDetails: body.caseDetails,
        caseSummary: summarizeCase(body.caseDetails),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Illegal state transition";
      if (message.includes("Illegal")) {
        return NextResponse.json({ message }, { status: 403 });
      }
      throw error;
    }
  }

  if (
    body.stage ||
    body.platformFeePaid !== undefined ||
    body.paymentStatus ||
    body.caseManagerId ||
    body.practitionerId ||
    body.caseManagerInfo ||
    body.practitionerInfo ||
    body.bankInstructions ||
    body.paymentPlan ||
    body.terms
  ) {
    if (auth.session!.effectiveRole === "client") {
      // clients cannot set admin fields
      body.bankInstructions = undefined;
      body.paymentPlan = undefined;
      body.terms = undefined;
    }
    try {
      record = await updateCase(params.caseId, {
        ...body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Illegal state transition";
      if (message.includes("Illegal")) {
        return NextResponse.json({ message }, { status: 403 });
      }
      throw error;
    }
  }

  return NextResponse.json(record);
}
