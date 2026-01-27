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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<T>(res));

export const updateCaseRecord = <T extends object, R = any>(caseId: string, payload: T) =>
  fetch(buildUrl(`/api/cases/${caseId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<R>(res));

export const fetchCaseRecord = <T = any>(caseId: string) =>
  fetch(buildUrl(`/api/cases/${caseId}`)).then((res) => handleResponse<T>(res));
