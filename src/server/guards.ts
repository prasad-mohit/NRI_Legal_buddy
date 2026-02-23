import { NextResponse } from "next/server";

import { getCase } from "@/server/storage";
import type { CaseStatus, StageStatus } from "@/server/types";
import { normalizeCaseStatus, normalizeStageStatus } from "../../core/stateMachine.js";

const toArray = <T,>(value: T | T[]) => (Array.isArray(value) ? value : [value]);

export const checkRole = (sessionRole: string | undefined, required: string | string[]) => {
  const allowed = toArray(required);
  if (!sessionRole || !allowed.includes(sessionRole)) {
    return NextResponse.json(
      { message: "Forbidden: role check failed", required },
      { status: 403 }
    );
  }
  return null;
};

export const checkCaseState = async (
  caseId: string,
  required: CaseStatus | CaseStatus[]
) => {
  const record = await getCase(caseId);
  if (!record) {
    return {
      record: null,
      response: NextResponse.json({ message: "Case not found" }, { status: 404 }),
    };
  }
  const allowed = toArray(required);
  const status = normalizeCaseStatus(record.caseStatus as CaseStatus);
  if (!allowed.includes(status)) {
    return {
      record,
      response: NextResponse.json(
        { message: `Forbidden: case status must be ${allowed.join(" | ")}`, status },
        { status: 403 }
      ),
    };
  }
  return { record, response: null };
};

export const checkStageState = async (
  caseId: string,
  required: StageStatus | StageStatus[]
) => {
  const record = await getCase(caseId);
  if (!record) {
    return {
      record: null,
      response: NextResponse.json({ message: "Case not found" }, { status: 404 }),
    };
  }
  const allowed = toArray(required);
  const status = normalizeStageStatus(record.stageStatus as StageStatus);
  if (!allowed.includes(status)) {
    return {
      record,
      response: NextResponse.json(
        { message: `Forbidden: stage status must be ${allowed.join(" | ")}`, status },
        { status: 403 }
      ),
    };
  }
  return { record, response: null };
};
