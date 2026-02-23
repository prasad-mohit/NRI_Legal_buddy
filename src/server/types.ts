export type CaseStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AWAITING_CLIENT_APPROVAL"
  | "PAYMENT_PENDING"
  | "IN_PROGRESS"
  | "CLOSED";

export type StageStatus =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "PAYMENT_SUBMITTED"
  | "PAID"
  | "IN_PROGRESS"
  | "COMPLETE";

// Retain historical stage labels while we migrate to StageStatus-backed workflow.
export type CaseStage =
  | "service-selection"
  | "fee-payment"
  | "case-manager-assigned"
  | "practitioner-assigned"
  | "video-scheduled"
  | "documents"
  | "escrow"
  | StageStatus;

export interface ClientProfile {
  fullName: string;
  email: string;
  country: string;
}

export interface CaseRecord {
  id: string;
  user: ClientProfile;
  serviceId: string;
  stage: CaseStage;
  caseStatus: CaseStatus;
  stageStatus: StageStatus;
  platformFeePaid: boolean;
  paymentStatus: "pending" | "approved";
  caseDetails?: string;
  caseSummary?: string;
  caseManagerInfo?: {
    id: string;
    name: string;
    specialization: string;
    timezone: string;
    weeklyLoad: number;
  };
  practitionerInfo?: {
    id: string;
    name: string;
    bar: string;
    focus: string;
  };
  caseManagerId?: string;
  practitionerId?: string;
  videoSlot?: string;
  videoLink?: string;
  documentCount: number;
  escrowMilestones: Array<{ id: string; unlocked: boolean }>;
  timeline: Array<{
    id: string;
    title: string;
    description: string;
    actor: string;
    timestamp: string;
    status?: "done" | "live" | "upcoming";
  }>;
  bankInstructions?: string;
  paymentPlan?: string;
  paymentProofs?: Array<{
    id: string;
    submittedBy: string;
    submittedAt: string;
    url?: string;
    note?: string;
    approved?: boolean;
  }>;
  terms?: string;
}

export interface VideoReservation {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
}

export interface VaultDocument {
  id: string;
  caseId: string;
  name: string;
  type: string;
  status: "processing" | "ready";
  summary: string;
  uploadedAt: string;
}
