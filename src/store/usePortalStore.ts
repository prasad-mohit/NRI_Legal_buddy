"use client";

import { create } from "zustand";
import { format } from "date-fns";
import {
  createVideoMeeting,
  createCaseRecord,
  createRazorpayOrder,
  fetchCaseRecord,
  updateCaseRecord,
  verifyRazorpayPayment,
} from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  assurancePoints,
  legalServices,
  type LegalService,
  type ServiceId,
} from "@/lib/services";
import type { CaseStatus, StageStatus } from "@/server/types";

type JourneyStage =
  | "login"
  | "service-selection"    // pick service + fill case brief + upload pre-docs
  | "payment-pending"      // case submitted, user shows bank proof, waiting admin
  | "payment-approved"     // admin approved payment, awaiting lawyer assignment
  | "lawyer-assigned"      // CM + lawyer both assigned → all features unlocked
  | "fee-payment"          // legacy alias kept for old DB records
  | "case-manager-assigned"
  | "practitioner-assigned"
  | "video-scheduled"
  | "documents"
  | "escrow";

type TimelineStatus = "done" | "live" | "upcoming";

export interface TimelineEvent {
  id: string;
  title: string;
  timestamp: string;
  description: string;
  actor: string;
  status: TimelineStatus;
}

export interface VaultDocument {
  id: string;
  name: string;
  type: string;
  status: "ingested" | "processing" | "ready";
  updatedAt: string;
  summary: string;
}

export interface VideoCallSlot {
  id: string;
  scheduledAt: string;
  provider: string;
  link: string;
  status: "pending" | "confirmed" | "completed";
}

export interface EscrowMilestone {
  id: string;
  title: string;
  description: string;
  amountPct: number;
  unlocked: boolean;
}

interface ClientProfile {
  fullName: string;
  email: string;
  country: string;
  signupFeePaid?: boolean;
}

interface AuthUser extends ClientProfile {
  role: "client" | "lawyer" | "admin" | "super-admin";
}

interface PortalState {
  stage: JourneyStage;
  assurance: string[];
  user: ClientProfile | null;
  authError?: string;
  authLoading: boolean;
  authRole?: AuthUser["role"];
  caseId?: string;
  caseStatus?: CaseStatus;
  stageStatus?: StageStatus;
  paymentStatus: "pending" | "approved";
  paymentCaptured: boolean;
  paymentActionState: "idle" | "loading" | "success" | "error";
  paymentActionMessage?: string;
  caseDetails?: string;
  caseSummary?: string;
  assignedCaseManager?: {
    id: string;
    name: string;
    specialization: string;
    timezone: string;
    weeklyLoad: number;
  };
  assignedPractitioner?: {
    id: string;
    name: string;
    bar: string;
    focus: string;
  };
  bankInstructions?: string;
  paymentPlan?: string;
  paymentProofs?: {
    id: string;
    submittedBy: string;
    submittedAt: string;
    url?: string;
    note?: string;
    approved?: boolean;
  }[];
  terms?: string;
  selectedService?: LegalService;
  platformFeePaid: boolean;
  timeline: TimelineEvent[];
  documents: VaultDocument[];
  videoCall?: VideoCallSlot;
  escrowMilestones: EscrowMilestone[];
  loginUser: (profile: ClientProfile) => void;
  hydrateAuthSession: () => Promise<void>;
  logoutUser: () => Promise<void>;
  loginWithCredentials: (payload: { email: string; password: string }) => Promise<AuthUser | null>;
  startSignupOtp: (
    profile: ClientProfile & { password: string }
  ) => Promise<{ email: string; expiresInMinutes: number; testOtp?: string } | null>;
  verifySignupOtp: (payload: { email: string; otp: string }) => Promise<AuthUser | null>;
  signupUser: (profile: ClientProfile & { password: string }) => Promise<AuthUser | null>;
  refreshCaseStatus: () => Promise<void>;
  syncCases: () => Promise<void>;
  setCaseDetailsDraft: (details: string) => void;
  submitCaseDetails: (details: string) => Promise<void>;
  selectService: (serviceId: ServiceId) => void;
  capturePlatformFee: () => Promise<void>;
  scheduleVideoCall: (when: string) => Promise<void>;
  addDocument: (name: string, type: string, fileName?: string) => Promise<void>;
  advanceEscrow: () => Promise<void>;
  submitPaymentProof: (payload: { url?: string; note?: string }) => Promise<void>;
  reset: () => void;
}

const baseDocuments: VaultDocument[] = [
  {
    id: "doc-passport",
    name: "Passport Bio Page",
    type: "Identity",
    status: "ready",
    updatedAt: new Date().toISOString(),
    summary: "Verified passport copy with MRZ scan and apostille stamp.",
  },
  {
    id: "doc-poa",
    name: "Notarized Power of Attorney",
    type: "Authority",
    status: "ingested",
    updatedAt: new Date().toISOString(),
    summary: "POA drafted for property dispute mandate covering litigation filings.",
  },
];

const baseEscrow: EscrowMilestone[] = [
  {
    id: "agreement",
    title: "Scope & fee accepted",
    description: "Client signs platform-controlled mandate.",
    amountPct: 0,
    unlocked: false,
  },
  {
    id: "escrow-open",
    title: "Escrow opened @ Indian Bank",
    description: "Dedicated account seeded with client funds.",
    amountPct: 0,
    unlocked: false,
  },
  {
    id: "court-filing",
    title: "Case filed – release 60%",
    description: "Platform authorized to deploy 60% once filing receipt is uploaded.",
    amountPct: 60,
    unlocked: false,
  },
  {
    id: "court-movement",
    title: "Case listed – release balance",
    description: "Remaining 40% auto-released when court listing order is recorded.",
    amountPct: 40,
    unlocked: false,
  },
];

const formatTimestamp = () => format(new Date(), "dd MMM yyyy, HH:mm");

const hasPaymentCaptureEvent = (
  timeline: Array<{ id?: string; title?: string }> | undefined
) =>
  (timeline ?? []).some(
    (item) =>
      (item.id ?? "").startsWith("evt-payment-verified") ||
      (item.title ?? "").toLowerCase().includes("payment captured")
  );

const mapPaymentError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Payment failed";
  if (message === "CHECKOUT_DISMISSED") {
    return "Checkout was closed before payment completion. You can retry.";
  }
  if (message === "CHECKOUT_SCRIPT_LOAD_FAILED" || message === "CHECKOUT_UNAVAILABLE") {
    return "Secure checkout could not load. Check your network and retry.";
  }
  if (message === "CHECKOUT_OPEN_FAILED") {
    return "Unable to open checkout. Please retry.";
  }
  if (message.startsWith("CHECKOUT_PAYMENT_FAILED:")) {
    return message.slice("CHECKOUT_PAYMENT_FAILED:".length).trim() || "Payment failed. Retry.";
  }
  return message || "Payment failed. Retry.";
};

const getMessageFromResponse = async (res: Response) => {
  try {
    const parsed = (await res.json()) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // fall through
  }
  return "Request failed";
};

export const usePortalStore = create<PortalState>((set, get) => {
  const parseMeta = <T,>(value: unknown): T | undefined => {
    if (!value) return undefined;
    if (typeof value === "object") return value as T;
    try {
      return JSON.parse(String(value)) as T;
    } catch (error) {
      console.error("[debug][portal] meta parse failed", error);
      return undefined;
    }
  };

  const ingestCaseRecord = (record: any, source: string) => {
    const timeline = Array.isArray(record.timeline) ? record.timeline : [];
    const escrow =
      Array.isArray(record.escrowMilestones) && record.escrowMilestones.length
        ? record.escrowMilestones
        : get().escrowMilestones;
    const paymentApproved = record.paymentStatus === "approved";
    const platformFeePaid =
      paymentApproved ||
      Boolean(record.platformFeePaid === 1 || record.platformFeePaid) ||
      get().platformFeePaid;
    const paymentCaptured = hasPaymentCaptureEvent(timeline) || paymentApproved;
    const caseManager =
      record.caseManagerInfo ?? parseMeta<typeof record.caseManagerInfo>(record.caseManagerMeta);
    const practitioner =
      record.practitionerInfo ?? parseMeta<typeof record.practitionerInfo>(record.practitionerMeta);
    const caseStatus = (record.caseStatus as CaseStatus | undefined) ?? get().caseStatus ?? "SUBMITTED";
    const stageStatus =
      (record.stageStatus as StageStatus | undefined) ?? get().stageStatus ?? "PENDING";

    // Map stage to new names for backward compat with old DB records
    const rawStage: string = record.stage ?? get().stage ?? "service-selection";
    const stageMap: Record<string, JourneyStage> = {
      "fee-payment": "payment-pending",
      "case-manager-assigned": "payment-approved",
      "practitioner-assigned": "lawyer-assigned",
    };
    const mappedStage: JourneyStage = (stageMap[rawStage] as JourneyStage | undefined) ?? (rawStage as JourneyStage);
    // If lawyer assigned, always show lawyer-assigned regardless of stored stage
    const resolvedStage: JourneyStage = practitioner ? "lawyer-assigned" : mappedStage;

    console.log("[debug][portal] ingestCaseRecord", {
      source,
      id: record.id,
      paymentStatus: record.paymentStatus,
      platformFeePaid,
      paymentCaptured,
      stage: record.stage,
      timelineCount: timeline.length,
    });

    set({
      caseId: record.id,
      stage: resolvedStage,
      paymentStatus: record.paymentStatus ?? "pending",
      platformFeePaid,
      paymentCaptured,
      paymentActionState: "idle",
      paymentActionMessage: undefined,
      caseDetails: record.caseDetails ?? undefined,
      caseSummary: record.caseSummary ?? undefined,
      assignedCaseManager: caseManager ?? undefined,
      assignedPractitioner: practitioner ?? undefined,
      caseStatus,
      stageStatus,
      timeline,
      escrowMilestones: escrow,
      bankInstructions: record.bankInstructions ?? undefined,
      paymentPlan: record.paymentPlan ?? undefined,
      paymentProofs: record.paymentProofs ?? [],
      terms: record.terms ?? undefined,
    });
  };

  const syncCasesFromBackend = async (source: string) => {
    try {
      console.log("[debug][portal] syncCasesFromBackend.start", { source });
      const res = await fetch("/api/cases", { credentials: "include" });
      if (!res.ok) {
        console.error("[debug][portal] /api/cases failed", res.status);
        return;
      }
      const data = (await res.json()) as { cases?: any[] };
      const cases = data.cases ?? [];
      console.log("[debug][portal] /api/cases received", cases.length);
      if (!cases.length) {
        console.log("[debug][portal] /api/cases empty for user");
        // If signup fee already paid, auto-create first case so user can proceed.
        const user = get().user;
        const svc = legalServices[0];
        if (user && user.signupFeePaid && svc) {
          try {
            const timeline = [
              {
                id: "evt-auto-case",
                title: "Case created",
                timestamp: formatTimestamp(),
                description: "Signup fee completed. Case initialized.",
                actor: "System",
                status: "live" as const,
              },
            ];
            const record = await createCaseRecord({
              user,
              serviceId: svc.id,
              stage: "case-manager-assigned",
              caseStatus: "IN_PROGRESS",
              stageStatus: "PAID",
              platformFeePaid: true,
              paymentStatus: "approved",
              timeline,
              escrowMilestones: get().escrowMilestones,
              bankInstructions: get().bankInstructions,
              paymentPlan: get().paymentPlan,
              terms: get().terms,
            } as any);
            ingestCaseRecord(record, "auto-created");
            return;
          } catch (err) {
            console.error("[debug][portal] auto-create case failed", err);
          }
        }
        return;
      }
      const approved = cases.filter(
        (item) =>
          item.paymentStatus === "approved" &&
          (item.platformFeePaid === true || item.platformFeePaid === 1)
      );
      const selected = approved[0] ?? cases[0];
      console.log("[debug][portal] case selection", {
        selectedId: selected?.id,
        reason: approved[0] ? "approved+paid" : "fallback-first",
        approvedCount: approved.length,
      });
      if (selected) {
        ingestCaseRecord(selected, source);
      }
    } catch (error) {
      console.error("[debug][portal] syncCasesFromBackend error", error);
    }
  };

  return {
    stage: "login",
    assurance: assurancePoints,
    user: null,
    authError: undefined,
    authLoading: false,
    authRole: undefined,
    caseId: undefined,
    caseStatus: "SUBMITTED",
    stageStatus: "PENDING",
    paymentStatus: "pending",
    paymentCaptured: false,
    paymentActionState: "idle",
    paymentActionMessage: undefined,
    caseDetails: undefined,
    caseSummary: undefined,
    bankInstructions: undefined,
    paymentPlan: undefined,
    paymentProofs: [],
    terms: undefined,
    assignedCaseManager: undefined,
    assignedPractitioner: undefined,
    selectedService: undefined,
    platformFeePaid: false,
    timeline: [],
    documents: [...baseDocuments],
    videoCall: undefined,
    escrowMilestones: baseEscrow.map((milestone) => ({ ...milestone })),

  loginUser: (profile) => {
    set({
      user: profile,
      authError: undefined,
      authRole: "client",
      paymentCaptured: Boolean(profile.signupFeePaid),
      paymentActionState: "idle",
      paymentActionMessage: undefined,
      stage: "service-selection",
      caseStatus: "SUBMITTED",
      stageStatus: "PENDING",
      platformFeePaid: Boolean(profile.signupFeePaid),
      timeline: [
        {
          id: "evt-login",
          title: "Secure login",
          timestamp: formatTimestamp(),
          description: `Client verified from ${profile.country}.`,
          actor: "Platform",
          status: "done" as const,
        },
      ],
    });
  },

  hydrateAuthSession: async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        user: AuthUser | null;
      };
      if (!data.user) return;
      if (data.user.role === "admin" || data.user.role === "super-admin") {
        set({
          user: null,
          authRole: data.user.role,
          authError: undefined,
        });
        return;
      }
      get().loginUser(data.user);
      await syncCasesFromBackend("hydrate-session");
      set({
        authRole: "client",
        authError: undefined,
      });
    } catch (error) {
      console.error("Failed to hydrate auth session", error);
    }
  },

  logoutUser: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout request failed", error);
    }
    get().reset();
  },
    syncCases: async () => {
      await syncCasesFromBackend("manual-sync");
    },

  loginWithCredentials: async (payload) => {
    set({ authLoading: true, authError: undefined });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await getMessageFromResponse(res);
        set({ authLoading: false, authError: message || "Login failed" });
        return null;
      }
      const data = (await res.json()) as { user: AuthUser };
      if (data.user.role === "admin" || data.user.role === "super-admin") {
        set({ authLoading: false, authRole: data.user.role });
        return data.user;
      }
      get().loginUser(data.user);
      await syncCasesFromBackend("login-with-credentials");
      set({ authLoading: false, authRole: "client" });
      return data.user;
    } catch (error) {
      console.error("Login failed", error);
      set({ authLoading: false, authError: "Login failed" });
      return null;
    }
  },

  startSignupOtp: async (profile) => {
    set({ authLoading: true, authError: undefined });
    try {
      const res = await fetch("/api/auth/signup/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const message = await getMessageFromResponse(res);
        set({ authLoading: false, authError: message || "Signup failed" });
        return null;
      }
      const data = (await res.json()) as {
        email: string;
        expiresInMinutes: number;
        testOtp?: string;
      };
      set({ authLoading: false, authError: undefined });
      return data;
    } catch (error) {
      console.error("Signup OTP request failed", error);
      set({ authLoading: false, authError: "Signup failed" });
      return null;
    }
  },

  verifySignupOtp: async (payload) => {
    set({ authLoading: true, authError: undefined });
    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await getMessageFromResponse(res);
        set({ authLoading: false, authError: message || "OTP verification failed" });
        return null;
      }
      const data = (await res.json()) as { user: AuthUser };
      if (data.user.role === "admin" || data.user.role === "super-admin") {
        set({ authLoading: false, authRole: data.user.role });
        return data.user;
      }
      get().loginUser(data.user);
      await syncCasesFromBackend("verify-signup-otp");
      set({ authLoading: false, authRole: "client" });
      return data.user;
    } catch (error) {
      console.error("Signup OTP verification failed", error);
      set({ authLoading: false, authError: "OTP verification failed" });
      return null;
    }
  },

  signupUser: async (profile) => {
    const started = await get().startSignupOtp(profile);
    if (!started) return null;
    set({
      authError: "Verification code sent. Please complete OTP verification.",
    });
    return null;
  },

  refreshCaseStatus: async () => {
    const { caseId } = get();
    if (!caseId) return;
    try {
      const record = await fetchCaseRecord(caseId);
      console.log("[debug][portal] refreshCaseStatus", {
        caseId,
        paymentStatus: record.paymentStatus,
        platformFeePaid: record.platformFeePaid,
        stage: record.stage,
      });
      set({
        caseStatus: (record as any).caseStatus ?? get().caseStatus,
        stageStatus: (record as any).stageStatus ?? get().stageStatus,
        paymentStatus: record.paymentStatus ?? "pending",
        platformFeePaid: Boolean(record.platformFeePaid) || record.paymentStatus === "approved",
        paymentCaptured: hasPaymentCaptureEvent(record.timeline) || record.paymentStatus === "approved" || Boolean((record as any).paymentProofs?.length),
        paymentActionState: "idle",
        paymentActionMessage: undefined,
        caseDetails: record.caseDetails ?? undefined,
        caseSummary: record.caseSummary ?? undefined,
        assignedCaseManager: record.caseManagerInfo ?? undefined,
        assignedPractitioner: record.practitionerInfo ?? undefined,
        stage: record.stage ?? get().stage,
        timeline: record.timeline ?? get().timeline,
        escrowMilestones:
          (Array.isArray(record.escrowMilestones) && record.escrowMilestones.length
            ? record.escrowMilestones
            : get().escrowMilestones),
        bankInstructions: record.bankInstructions ?? get().bankInstructions,
        paymentPlan: record.paymentPlan ?? get().paymentPlan,
        paymentProofs: record.paymentProofs ?? get().paymentProofs,
        terms: record.terms ?? get().terms,
      });
    } catch (error) {
      console.error("Failed to refresh case", error);
    }
  },

  setCaseDetailsDraft: (details) => {
    set({ caseDetails: details });
  },

  submitCaseDetails: async (details) => {
    const { caseId } = get();
    if (!caseId) {
      set({ caseDetails: details });
      return;
    }
    try {
      const record = await updateCaseRecord(caseId, { caseDetails: details });
      set({
        caseDetails: record.caseDetails ?? details,
        caseSummary: record.caseSummary ?? undefined,
      });
    } catch (error) {
      console.error("Failed to update case details", error);
    }
  },

  selectService: (serviceId) => {
    const svc = legalServices.find((s) => s.id === serviceId);
    if (!svc) return;
    // Stay on service-selection so user can fill brief + upload docs before paying
    set({
      selectedService: svc,
      stage: "service-selection",
      paymentCaptured: false,
      paymentActionState: "idle",
      paymentActionMessage: undefined,
    });
  },

  capturePlatformFee: async () => {
    // Simplified: just create the case record so user can submit payment proof.
    // No Razorpay — payment is manual bank transfer verified by admin.
    const { selectedService, user, escrowMilestones, caseId } = get();
    if (!selectedService || !user) return;
    if (caseId) {
      // Case already exists; transition to payment-pending to show proof form
      set({ stage: "payment-pending", paymentActionState: "idle" });
      return;
    }
    set({ paymentActionState: "loading", paymentActionMessage: "Registering case…" });
    const timeline = get().timeline.concat({
      id: "evt-case-submitted",
      title: "Case submitted",
      timestamp: formatTimestamp(),
      description: `${selectedService.label} case registered. Awaiting $50 platform fee.`,
      actor: "Client",
      status: "live" as const,
    });
    try {
      const record = await createCaseRecord({
        user,
        serviceId: selectedService.id,
        stage: "payment-pending",
        caseStatus: "SUBMITTED",
        stageStatus: "AWAITING_PAYMENT",
        platformFeePaid: false,
        paymentStatus: "pending",
        caseDetails: get().caseDetails,
        timeline,
        escrowMilestones,
      } as any);
      set({
        caseId: record.id,
        stage: "payment-pending",
        caseStatus: "SUBMITTED",
        stageStatus: "AWAITING_PAYMENT",
        paymentStatus: "pending",
        paymentCaptured: false,
        platformFeePaid: false,
        timeline: (record.timeline as TimelineEvent[] | undefined) ?? timeline,
        caseSummary: record.caseSummary ?? undefined,
        paymentActionState: "idle",
        paymentActionMessage: undefined,
      });
    } catch (error) {
      console.error("Failed to create case", error);
      set({
        paymentActionState: "error",
        paymentActionMessage: error instanceof Error ? error.message : "Case creation failed",
      });
    }
  },

  scheduleVideoCall: async (when) => {
    if (!get().assignedPractitioner) return;  // must have lawyer assigned
    const { caseId } = get();
    if (!caseId) return;

    const timeline = get().timeline.map((item, idx, arr) =>
      idx === arr.length - 1 ? { ...item, status: "done" as const } : item
    );
    const entry = {
      id: "evt-video",
      title: "Video consult scheduled",
      timestamp: formatTimestamp(),
      description: `Confirmed for ${when} via Amazon Chime.`,
      actor: "Practitioner",
      status: "live" as const,
    };
    timeline.push(entry);

    try {
      const result = await createVideoMeeting({
        caseId,
        scheduledAt: when,
      });
        set({
          videoCall: {
            id: result.meeting.id,
            scheduledAt: result.meeting.scheduledAt,
            provider: "Amazon Chime",
            link: result.meeting.link,
            status: "confirmed",
          },
          stage: "video-scheduled",
          timeline: (result.caseRecord.timeline as TimelineEvent[] | undefined) ?? timeline,
        });
      return;
    } catch (error) {
      console.error("Failed to create video meeting", error);
    }

    set({
      stage: "video-scheduled",
      timeline,
    });
  },

  addDocument: async (name, type, fileName) => {
    // Pre-case docs allowed from service-selection/payment-pending too
    const { caseId } = get();
    const documentRecord = {
      id: `doc-${Date.now()}`,
      name,
      type,
      status: "processing" as const,
      updatedAt: new Date().toISOString(),
      summary: `${type} uploaded by client${fileName ? ` (${fileName})` : ""}. OCR & clause extraction running.`,
    };
    const documents = [...get().documents, documentRecord];
    // Don't overwrite current stage when adding docs
    set({ documents });
    if (caseId) {
      try {
        await updateCaseRecord(caseId, {
          document: {
            name,
            type,
            status: "processing" as const,
            summary: documentRecord.summary,
          },
        });
      } catch (error) {
        console.error("Failed to persist document metadata", error);
      }
    }
  },

  submitPaymentProof: async (payload) => {
    const { caseId } = get();
    if (!caseId) return;
    try {
      await updateCaseRecord(caseId, { paymentProof: payload } as any);
      set({ stage: "payment-pending", paymentCaptured: true });
      await get().refreshCaseStatus();
    } catch (error) {
      console.error("Failed to submit payment proof", error);
    }
  },

  advanceEscrow: async () => {
    if (!get().assignedPractitioner) return;  // must have lawyer assigned
    const current = get().escrowMilestones;
    const nextIndex = current.findIndex((item) => !item.unlocked);
    if (nextIndex === -1) return;
    const updated = current.map((item, idx) =>
      idx === nextIndex ? { ...item, unlocked: true } : item
    );
    const timeline = get().timeline.map((item, idx, arr) =>
      idx === arr.length - 1 ? { ...item, status: "done" as const } : item
    );
    const entry = {
      id: `evt-escrow-${nextIndex}`,
      title: updated[nextIndex].title,
      timestamp: formatTimestamp(),
      description: updated[nextIndex].description,
      actor: "Escrow Desk",
      status: "live" as const,
    };
    timeline.push(entry);
    const { caseId } = get();
    if (caseId) {
      try {
        const record = await updateCaseRecord(caseId, {
          escrowAdvance: true,
          timelineEntry: entry,
        });
        set({
          escrowMilestones: record.escrowMilestones ?? updated,
          stage: record.stage ?? "escrow",
          timeline: record.timeline ?? timeline,
        });
        return;
      } catch (error) {
        console.error("Failed to advance escrow remotely", error);
      }
    }
    set({ escrowMilestones: updated, stage: "escrow", timeline });
  },

  reset: () => {
    set({
      stage: "login",
      user: null,
      authError: undefined,
      authLoading: false,
      authRole: undefined,
      selectedService: undefined,
      platformFeePaid: false,
      paymentStatus: "pending",
      paymentCaptured: false,
      paymentActionState: "idle",
      paymentActionMessage: undefined,
      caseDetails: undefined,
      caseSummary: undefined,
      assignedCaseManager: undefined,
      assignedPractitioner: undefined,
      videoCall: undefined,
      caseId: undefined,
      caseStatus: "SUBMITTED",
      stageStatus: "PENDING",
      timeline: [],
      documents: [...baseDocuments],
      escrowMilestones: baseEscrow.map((milestone) => ({
        ...milestone,
        unlocked: false,
      })),
    });
  },
};
});
