// Centralized, strict state machine for case and stage lifecycles.
// This file is intentionally plain JS so it can be imported from both TS and JS modules.

export const CaseStatus = {
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  AWAITING_CLIENT_APPROVAL: "AWAITING_CLIENT_APPROVAL",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  CLOSED: "CLOSED",
};

export const StageStatus = {
  PENDING: "PENDING",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAYMENT_SUBMITTED: "PAYMENT_SUBMITTED",
  PAID: "PAID",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "COMPLETE",
};

// Allowed transitions are defined as a directed graph keyed by current state.
export const allowedCaseTransitions = {
  [CaseStatus.SUBMITTED]: [
    CaseStatus.UNDER_REVIEW,
    CaseStatus.AWAITING_CLIENT_APPROVAL,
    CaseStatus.PAYMENT_PENDING,
  ],
  [CaseStatus.UNDER_REVIEW]: [CaseStatus.AWAITING_CLIENT_APPROVAL, CaseStatus.PAYMENT_PENDING],
  [CaseStatus.AWAITING_CLIENT_APPROVAL]: [CaseStatus.PAYMENT_PENDING, CaseStatus.UNDER_REVIEW],
  [CaseStatus.PAYMENT_PENDING]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.IN_PROGRESS]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};

export const allowedStageTransitions = {
  [StageStatus.PENDING]: [
    StageStatus.AWAITING_PAYMENT,
    StageStatus.PAYMENT_SUBMITTED,
    StageStatus.PAID,
    StageStatus.IN_PROGRESS,
  ],
  [StageStatus.AWAITING_PAYMENT]: [StageStatus.PAYMENT_SUBMITTED],
  [StageStatus.PAYMENT_SUBMITTED]: [StageStatus.PAID],
  [StageStatus.PAID]: [StageStatus.IN_PROGRESS],
  [StageStatus.IN_PROGRESS]: [StageStatus.COMPLETE],
  [StageStatus.COMPLETE]: [],
};

const isSame = (current, next) => current === next;

export const validateCaseTransition = (current, next) => {
  if (!next || !current) return;
  if (isSame(current, next)) return;
  const allowed = allowedCaseTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    const message = `Illegal case transition: ${current} -> ${next}`;
    throw new Error(message);
  }
};

export const validateStageTransition = (current, next) => {
  if (!next || !current) return;
  if (isSame(current, next)) return;
  const allowed = allowedStageTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    const message = `Illegal stage transition: ${current} -> ${next}`;
    throw new Error(message);
  }
};

export const normalizeCaseStatus = (value) =>
  Object.values(CaseStatus).includes(value) ? value : CaseStatus.SUBMITTED;

export const normalizeStageStatus = (value) =>
  Object.values(StageStatus).includes(value) ? value : StageStatus.PENDING;
