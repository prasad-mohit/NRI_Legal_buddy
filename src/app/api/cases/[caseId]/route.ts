import { NextResponse } from "next/server";

import { advanceEscrow, addDocument, getCase, logTimelineEntry, recordVideo, updateCase } from "@/server/storage";
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
  const record = await getCase(params.caseId);
  if (!record) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
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
  }>;

  let record = await getCase(params.caseId);
  if (!record) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
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
  }

  if (body.escrowAdvance) {
    record = await advanceEscrow(params.caseId);
  }

  if (body.caseDetails) {
    record = await updateCase(params.caseId, {
      caseDetails: body.caseDetails,
      caseSummary: summarizeCase(body.caseDetails),
    });
  }

  if (
    body.stage ||
    body.platformFeePaid !== undefined ||
    body.paymentStatus ||
    body.caseManagerId ||
    body.practitionerId ||
    body.caseManagerInfo ||
    body.practitionerInfo
  ) {
    record = await updateCase(params.caseId, {
      ...body,
    });
  }

  return NextResponse.json(record);
}
