"use client";

import { create } from "zustand";
import { format } from "date-fns";
import { createCaseRecord, fetchCaseRecord, updateCaseRecord } from "@/lib/api-client";
import {
  assurancePoints,
  legalServices,
  type LegalService,
  type ServiceId,
} from "@/lib/services";

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
}

interface AuthUser extends ClientProfile {
  role: "client" | "admin";
}

interface PortalState {
  stage: JourneyStage;
  assurance: string[];
  user: ClientProfile | null;
  authError?: string;
  authLoading: boolean;
  authRole?: AuthUser["role"];
  caseId?: string;
  paymentStatus: "pending" | "approved";
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
  selectedService?: LegalService;
  platformFeePaid: boolean;
  timeline: TimelineEvent[];
  documents: VaultDocument[];
  videoCall?: VideoCallSlot;
  escrowMilestones: EscrowMilestone[];
  loginUser: (profile: ClientProfile) => void;
  loginWithCredentials: (payload: { email: string; password: string }) => Promise<AuthUser | null>;
  signupUser: (profile: ClientProfile & { password: string }) => Promise<AuthUser | null>;
  refreshCaseStatus: () => Promise<void>;
  setCaseDetailsDraft: (details: string) => void;
  submitCaseDetails: (details: string) => Promise<void>;
  selectService: (serviceId: ServiceId) => void;
  capturePlatformFee: () => Promise<void>;
  scheduleVideoCall: (when: string) => Promise<void>;
  addDocument: (name: string, type: string, fileName?: string) => Promise<void>;
  advanceEscrow: () => Promise<void>;
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

export const usePortalStore = create<PortalState>((set, get) => ({
  stage: "login",
  assurance: assurancePoints,
  user: null,
  authError: undefined,
  authLoading: false,
  authRole: undefined,
  caseId: undefined,
  paymentStatus: "pending",
  caseDetails: undefined,
  caseSummary: undefined,
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
      stage: "service-selection",
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

  loginWithCredentials: async (payload) => {
    set({ authLoading: true, authError: undefined });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await res.text();
        set({ authLoading: false, authError: message || "Login failed" });
        return null;
      }
      const data = (await res.json()) as { user: AuthUser };
      if (data.user.role === "admin") {
        set({ authLoading: false, authRole: "admin" });
        return data.user;
      }
      get().loginUser(data.user);
      set({ authLoading: false, authRole: "client" });
      return data.user;
    } catch (error) {
      console.error("Login failed", error);
      set({ authLoading: false, authError: "Login failed" });
      return null;
    }
  },

  signupUser: async (profile) => {
    set({ authLoading: true, authError: undefined });
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const message = await res.text();
        set({ authLoading: false, authError: message || "Signup failed" });
        return null;
      }
      const data = (await res.json()) as { user: AuthUser };
      get().loginUser(data.user);
      set({ authLoading: false, authRole: "client" });
      return data.user;
    } catch (error) {
      console.error("Signup failed", error);
      set({ authLoading: false, authError: "Signup failed" });
      return null;
    }
  },

  refreshCaseStatus: async () => {
    const { caseId } = get();
    if (!caseId) return;
    try {
      const record = await fetchCaseRecord(caseId);
      set({
        paymentStatus: record.paymentStatus ?? "pending",
        platformFeePaid: record.paymentStatus === "approved",
        caseDetails: record.caseDetails ?? undefined,
        caseSummary: record.caseSummary ?? undefined,
        assignedCaseManager: record.caseManagerInfo ?? undefined,
        assignedPractitioner: record.practitionerInfo ?? undefined,
        stage: record.stage ?? get().stage,
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
      timeline,
    });
  },

  capturePlatformFee: async () => {
    const { selectedService, user, escrowMilestones } = get();
    if (!selectedService || !user) return;
    const timeline = get().timeline.map((item, idx, arr) =>
      idx === arr.length - 1 ? { ...item, status: "done" as const } : item
    );
    timeline.push({
      id: "evt-platform-fee",
      title: "Platform fee request submitted",
      timestamp: formatTimestamp(),
      description: "$50 request sent for admin approval.",
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
      set({
        platformFeePaid: false,
        paymentStatus: "pending",
        stage: "fee-payment",
        timeline: record.timeline ?? timeline,
        escrowMilestones: record.escrowMilestones ?? updatedEscrow,
        caseId: record.id,
        caseSummary: record.caseSummary ?? undefined,
      });
    } catch (error) {
      console.error("Failed to persist case", error);
      set({
        platformFeePaid: false,
        paymentStatus: "pending",
        stage: "fee-payment",
        timeline,
        escrowMilestones: updatedEscrow,
      });
    }
  },

  scheduleVideoCall: async (when) => {
    if (!get().platformFeePaid) return;
    const timeline = get().timeline.map((item, idx, arr) =>
      idx === arr.length - 1 ? { ...item, status: "done" as const } : item
    );
    const entry = {
      id: "evt-video",
      title: "Video consult scheduled",
      timestamp: formatTimestamp(),
      description: `Confirmed for ${when} via SecureMeet.`,
      actor: "Practitioner",
      status: "live" as const,
    };
    timeline.push(entry);
    const payloadVideo = {
      id: `vc-${Date.now()}`,
      scheduledAt: when,
      provider: "SecureMeet",
      link: "https://meet.nri-law-buddy.com/case/alpha",
      status: "confirmed" as const,
    };
    const { caseId } = get();
    if (caseId) {
      try {
        const record = await updateCaseRecord(caseId, {
          videoSlot: when,
          timelineEntry: entry,
        });
        set({
          videoCall: {
            ...payloadVideo,
            link: record.videoLink ?? payloadVideo.link,
          },
          stage: "video-scheduled",
          timeline: record.timeline ?? timeline,
        });
        return;
      } catch (error) {
        console.error("Failed to persist video slot", error);
      }
    }
    set({
      videoCall: payloadVideo,
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

  reset: () =>
    set({
      stage: "login",
      user: null,
      authError: undefined,
      authLoading: false,
      authRole: undefined,
      selectedService: undefined,
      platformFeePaid: false,
      paymentStatus: "pending",
      caseDetails: undefined,
      caseSummary: undefined,
      assignedCaseManager: undefined,
      assignedPractitioner: undefined,
      videoCall: undefined,
      caseId: undefined,
      timeline: [],
      documents: [...baseDocuments],
      escrowMilestones: baseEscrow.map((milestone) => ({
        ...milestone,
        unlocked: false,
      })),
    }),
}));
