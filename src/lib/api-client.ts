const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const isBrowser = typeof window !== "undefined";

const buildUrl = (path: string) => {
  if (API_BASE) return `${API_BASE}${path}`;
  if (!isBrowser) {
    throw new Error("API_BASE_UNAVAILABLE");
  }
  return path;
};

export interface CreateCasePayload {
  user: {
    fullName: string;
    email: string;
    country: string;
  };
  serviceId: string;
  stage: string;
  caseStatus?: string;
  stageStatus?: string;
  platformFeePaid: boolean;
  paymentStatus?: "pending" | "approved";
  caseDetails?: string;
  timeline: Array<{
    id: string;
    title: string;
    description: string;
    actor: string;
    timestamp: string;
    status?: "done" | "live" | "upcoming";
  }>;
  escrowMilestones: Array<{ id: string; unlocked: boolean }>;
}

export interface RazorpayOrderPayload {
  mode: "mock" | "live";
  keyId?: string;
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    [key: string]: unknown;
  };
}

export interface VerifyRazorpayPayload {
  caseId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyRazorpayResponse {
  verified: boolean;
  caseId: string;
  paymentStatus: "pending" | "approved";
  requiresAdminApproval: boolean;
}

export interface VideoMeetingResponse {
  meeting: {
    id: string;
    caseId: string;
    scheduledAt: string;
    link: string;
    provider: string;
    createdByEmail: string;
    createdAt: string;
    chimeMeetingId: string;
    chimeExternalMeetingId: string;
    mediaRegion: string;
  };
  caseRecord: {
    stage?: string;
    timeline?: Array<{
      id: string;
      title: string;
      description: string;
      actor: string;
      timestamp: string;
      status?: "done" | "live" | "upcoming";
    }>;
  };
}

async function handleResponse<T>(res: Response) {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const createCaseRecord = <T = any>(payload: CreateCasePayload) =>
  fetch(buildUrl("/api/cases"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<T>(res));

export const updateCaseRecord = <T extends object, R = any>(caseId: string, payload: T) =>
  fetch(buildUrl(`/api/cases/${caseId}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<R>(res));

export const fetchCaseRecord = <T = any>(caseId: string) =>
  fetch(buildUrl(`/api/cases/${caseId}`), { credentials: "include" }).then((res) =>
    handleResponse<T>(res)
  );

export const createRazorpayOrder = (payload: { caseId: string }) =>
  fetch(buildUrl("/api/payments/razorpay/order"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<RazorpayOrderPayload>(res));

export const verifyRazorpayPayment = (payload: VerifyRazorpayPayload) =>
  fetch(buildUrl("/api/payments/razorpay/verify"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<VerifyRazorpayResponse>(res));

export const createVideoMeeting = (payload: { caseId: string; scheduledAt: string }) =>
  fetch(buildUrl("/api/video/create"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<VideoMeetingResponse>(res));
