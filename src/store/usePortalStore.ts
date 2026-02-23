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
  | "service-selection"
  | "fee-payment"
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
      stage: record.stage ?? get().stage,
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
      paymentCaptured: false,
      paymentActionState: "idle",
      paymentActionMessage: undefined,
      stage: profile.signupFeePaid ? "service-selection" : "fee-payment",
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
        paymentCaptured: hasPaymentCaptureEvent(record.timeline) || record.paymentStatus === "approved",
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
    const timeline = get().timeline.map((item, idx, arr) =>
      idx === arr.length - 1 ? { ...item, status: "done" as const } : item
    );
    timeline.push({
      id: `evt-${serviceId}`,
      title: `${svc.label} selected`,
      timestamp: formatTimestamp(),
      description: svc.summary,
      actor: "Client",
      status: "live" as const,
    });
    set({
      selectedService: svc,
      stage: "fee-payment",
      paymentCaptured: false,
      paymentActionState: "idle",
      paymentActionMessage: undefined,
      timeline,
    });
  },

  capturePlatformFee: async () => {
    const { selectedService, user, escrowMilestones, caseId, platformFeePaid } = get();
    if (!selectedService || !user) return;

    // Signup fee already paid globally: create case immediately (no checkout)
    if (platformFeePaid) {
      let workingCaseId = caseId;
      let workingTimeline = get().timeline;
      let workingEscrow = escrowMilestones;
      if (!workingCaseId) {
        const timeline = get().timeline.map((item, idx, arr) =>
          idx === arr.length - 1 ? { ...item, status: "done" as const } : item
        );
        timeline.push({
          id: "evt-platform-fee",
          title: "Signup fee already completed",
          timestamp: formatTimestamp(),
          description: "$50 signup payment recorded. Case can proceed.",
          actor: "Billing Desk",
          status: "live" as const,
        });
        const updatedEscrow = escrowMilestones.map((milestone, index) =>
          index === 0 ? { ...milestone, unlocked: true } : milestone
        );
        try {
          const record = await createCaseRecord({
            user,
            serviceId: selectedService.id,
            stage: "case-manager-assigned",
            caseStatus: "IN_PROGRESS",
            stageStatus: "PAID",
            platformFeePaid: true,
            paymentStatus: "approved",
            caseDetails: get().caseDetails,
            timeline,
            escrowMilestones: updatedEscrow,
            paymentPlan: get().paymentPlan,
            bankInstructions: get().bankInstructions,
            terms: get().terms,
          } as any);
          workingCaseId = record.id;
          workingTimeline = (record.timeline as TimelineEvent[] | undefined) ?? timeline;
          workingEscrow = (record.escrowMilestones as EscrowMilestone[] | undefined) ?? updatedEscrow;
          set({
            platformFeePaid: true,
            paymentStatus: "approved",
            paymentCaptured: true,
            stage: record.stage ?? "case-manager-assigned",
            caseStatus: (record as any).caseStatus ?? "IN_PROGRESS",
            stageStatus: (record as any).stageStatus ?? "PAID",
            timeline: workingTimeline,
            escrowMilestones: workingEscrow,
            caseId: record.id,
            caseSummary: record.caseSummary ?? undefined,
          });
        } catch (error) {
          console.error("Failed to create case without checkout", error);
        }
      } else {
        set({
          paymentStatus: "approved",
          platformFeePaid: true,
          paymentCaptured: true,
          stage: "case-manager-assigned",
          caseStatus: "IN_PROGRESS",
          stageStatus: "PAID",
        });
      }
      return;
    }

    set({
      paymentActionState: "loading",
      paymentActionMessage: "Preparing secure checkout...",
    });

    let workingCaseId = caseId;
    let workingTimeline = get().timeline;
    let workingEscrow = escrowMilestones;

    if (!workingCaseId) {
      const timeline = get().timeline.map((item, idx, arr) =>
        idx === arr.length - 1 ? { ...item, status: "done" as const } : item
      );
      timeline.push({
        id: "evt-platform-fee",
        title: "Platform fee request submitted",
        timestamp: formatTimestamp(),
        description: "$50 request sent for checkout and admin approval.",
        actor: "Billing Desk",
        status: "live" as const,
      });
      const updatedEscrow = escrowMilestones.map((milestone, index) =>
        index === 0 ? { ...milestone, unlocked: true } : milestone
      );

      try {
        const record = await createCaseRecord({
          user,
          serviceId: selectedService.id,
          stage: "fee-payment",
          platformFeePaid: false,
          paymentStatus: "pending",
          caseDetails: get().caseDetails,
          timeline,
          escrowMilestones: updatedEscrow,
        });

        workingCaseId = record.id;
        workingTimeline = (record.timeline as TimelineEvent[] | undefined) ?? timeline;
        workingEscrow = (record.escrowMilestones as EscrowMilestone[] | undefined) ?? updatedEscrow;

        set({
          platformFeePaid: false,
          paymentStatus: "pending",
          paymentCaptured: hasPaymentCaptureEvent(record.timeline),
          stage: "fee-payment",
          timeline: workingTimeline,
          escrowMilestones: workingEscrow,
          caseId: record.id,
          caseSummary: record.caseSummary ?? undefined,
        });
      } catch (error) {
        console.error("Failed to persist case", error);
        set({
          platformFeePaid: false,
          paymentStatus: "pending",
          paymentCaptured: false,
          paymentActionState: "error",
          paymentActionMessage: "Unable to initialize case for payment. Please retry.",
          stage: "fee-payment",
          timeline,
          escrowMilestones: updatedEscrow,
        });
        return;
      }
    }

    if (!workingCaseId) {
      set({
        paymentActionState: "error",
        paymentActionMessage: "Missing case context for payment.",
      });
      return;
    }

    try {
      const order = await createRazorpayOrder({ caseId: workingCaseId });

      let paymentSignal: { orderId: string; paymentId: string; signature: string };
      if (order.mode === "mock") {
        paymentSignal = {
          orderId: order.order.id,
          paymentId: `pay_mock_${Date.now()}`,
          signature: "mock_signature",
        };
      } else {
        if (!order.keyId) {
          throw new Error("Payment gateway configuration missing checkout key.");
        }
        paymentSignal = await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.order.id,
          amount: order.order.amount,
          currency: order.order.currency,
          name: "NRI Law Buddy",
          description: "Platform fee",
          prefill: {
            name: user.fullName,
            email: user.email,
          },
        });
      }

      const verification = await verifyRazorpayPayment({
        caseId: workingCaseId,
        orderId: paymentSignal.orderId,
        paymentId: paymentSignal.paymentId,
        signature: paymentSignal.signature,
      });

      if (!verification.verified) {
        throw new Error("Payment verification failed.");
      }

      const timeline = (get().timeline.length ? get().timeline : workingTimeline).map(
        (item, idx, arr) => (idx === arr.length - 1 ? { ...item, status: "done" as const } : item)
      );
      const paymentEntry: TimelineEvent = {
        id: `evt-payment-verified-${Date.now()}`,
        title: "Payment captured",
        timestamp: formatTimestamp(),
        description: "Razorpay payment verified. Awaiting admin approval.",
        actor: "Billing Desk",
        status: "live",
      };
      timeline.push(paymentEntry);

      try {
        const record = await updateCaseRecord(workingCaseId, {
          timelineEntry: paymentEntry,
        });
        set({
          timeline: (record.timeline as TimelineEvent[] | undefined) ?? timeline,
        });
      } catch (error) {
        console.error("Failed to persist payment timeline entry", error);
        set({ timeline });
      }

      set({
        platformFeePaid: false,
        paymentStatus: verification.paymentStatus,
        paymentCaptured: true,
        paymentActionState: "success",
        paymentActionMessage: verification.requiresAdminApproval
          ? "Payment verified. Admin approval is pending."
          : "Payment verified successfully.",
        stage: "fee-payment",
        caseStatus: "PAYMENT_PENDING",
        stageStatus: "PAYMENT_SUBMITTED",
        escrowMilestones: workingEscrow,
        caseId: workingCaseId,
      });
    } catch (error) {
      console.error("Payment checkout failed", error);
      set({
        paymentActionState: "error",
        paymentActionMessage: mapPaymentError(error),
        paymentCaptured: false,
        platformFeePaid: false,
        paymentStatus: "pending",
      });
    }
  },

  scheduleVideoCall: async (when) => {
    if (!get().platformFeePaid) return;
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
    if (!get().platformFeePaid) return;
    const documentRecord = {
      id: `doc-${Date.now()}`,
      name,
      type,
      status: "processing" as const,
      updatedAt: new Date().toISOString(),
      summary: `${type} uploaded by client${fileName ? ` (${fileName})` : ""}. OCR & clause extraction running.`,
    };
    const documents = [...get().documents, documentRecord];
    set({ documents, stage: "documents" });
    const { caseId } = get();
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
      await get().refreshCaseStatus();
    } catch (error) {
      console.error("Failed to submit payment proof", error);
    }
  },

  advanceEscrow: async () => {
    if (!get().platformFeePaid) return;
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
