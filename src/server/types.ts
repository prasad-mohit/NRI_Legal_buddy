export type CaseStage =
  | "service-selection"
  | "fee-payment"
  | "case-manager-assigned"
  | "practitioner-assigned"
  | "video-scheduled"
  | "documents"
  | "escrow";

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
