"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ShieldCheck,
  UploadCloud,
  UserCheck,
  UserPlus,
  Video,
} from "lucide-react";

const cardShell =
  "rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

interface CaseRow {
  id: string;
  serviceId: string;
  stage: string;
  caseStatus?: string | null;
  stageStatus?: string | null;
  platformFeePaid: number;
  paymentStatus: string;
  caseDetails: string | null;
  caseSummary: string | null;
  caseManagerMeta: string | null;
  practitionerMeta: string | null;
  documentCount: number;
  videoSlot: string | null;
  updatedAt: string;
  fullName: string;
  email: string;
  country: string;
  bankInstructions?: string | null;
  paymentPlan?: string | null;
  terms?: string | null;
}

interface CaseManagerRow {
  id: string;
  name: string;
  timezone: string;
  specialization: string;
  weeklyLoad: number;
}

interface PractitionerRow {
  id: string;
  name: string;
  bar: string;
  focus: string;
}

interface ClientRow {
  id: string;
  fullName: string;
  email: string;
  country: string;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  caseId: string;
  name: string;
  type: string;
  status: string;
  summary: string;
  uploadedAt: string;
}

interface VideoRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  createdAt: string;
}

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  authorEmail: string;
  published: boolean;
  createdAt: string;
}

interface SessionRow {
  id: string;
  subjectEmail: string;
  role: string;
  actingAsEmail?: string | null;
  actingAsRole?: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

type CaseTab =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AWAITING_CLIENT_APPROVAL"
  | "PAYMENT_PENDING"
  | "IN_PROGRESS";

export default function AdminConsole() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<{ email: string; displayName: string; role: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [caseTab, setCaseTab] = useState<CaseTab>("SUBMITTED");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionCounts, setSessionCounts] = useState<{ active: number; total: number }>({
    active: 0,
    total: 0,
  });
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [blogDraft, setBlogDraft] = useState({
    title: "Announcing NRI Desk Expansion",
    slug: "",
    excerpt: "Cross-border legal support just got wider.",
    content: "Write your blog content here...",
    published: true,
  });
  const [paymentDrafts, setPaymentDrafts] = useState<
    Record<string, { bankInstructions?: string; paymentPlan?: string; terms?: string }>
  >({});
  const [managers, setManagers] = useState<CaseManagerRow[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerRow[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, { managerId?: string; practitionerId?: string }>
  >({});
  const [creating, setCreating] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "admin-secondary@nri-law-buddy.com",
    displayName: "Compliance Lead",
    role: "admin",
    password: "ChangeMe123!",
  });
  const [rosterPayload, setRosterPayload] = useState(
    JSON.stringify(
      {
        managers: [
          {
            id: "mgr-001",
            name: "Rhea Mehta",
            timezone: "IST",
            specialization: "Property & Title",
            weeklyLoad: 8,
          },
        ],
        practitioners: [
          {
            id: "prc-001",
            name: "Adv. Vikram Rao",
            bar: "Bombay High Court",
            focus: "Property litigation",
          },
        ],
      },
      null,
      2
    )
  );

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) {
      console.error("[debug][admin] loadUsers failed", res.status);
      return;
    }
    const data = (await res.json()) as { users: AdminUser[] };
    console.log("[debug][admin] users fetched", data.users?.length ?? 0);
    setUsers(data.users ?? []);
  };

  const loadDashboard = async () => {
    const [casesRes, clientsRes, docsRes, videosRes, sessionsRes, blogsRes] = await Promise.all([
      fetch("/api/admin/cases", { credentials: "include" }),
      fetch("/api/admin/clients", { credentials: "include" }),
      fetch("/api/admin/documents", { credentials: "include" }),
      fetch("/api/admin/videos", { credentials: "include" }),
      fetch("/api/admin/sessions", { credentials: "include" }),
      fetch("/api/admin/blogs", { credentials: "include" }),
    ]);

    if (casesRes.ok) {
      const data = (await casesRes.json()) as { cases: CaseRow[] };
      console.log("[debug][admin] cases fetched", data.cases?.length ?? 0);
      setCases(data.cases ?? []);
    } else {
      console.error("[debug][admin] cases fetch failed", casesRes.status);
    }
    if (clientsRes.ok) {
      const data = (await clientsRes.json()) as { clients: ClientRow[] };
      console.log("[debug][admin] clients fetched", data.clients?.length ?? 0);
      setClients(data.clients ?? []);
    } else {
      console.error("[debug][admin] clients fetch failed", clientsRes.status);
    }
    if (docsRes.ok) {
      const data = (await docsRes.json()) as { documents: DocumentRow[] };
      console.log("[debug][admin] documents fetched", data.documents?.length ?? 0);
      setDocuments(data.documents ?? []);
    } else {
      console.error("[debug][admin] documents fetch failed", docsRes.status);
    }
    if (videosRes.ok) {
      const data = (await videosRes.json()) as { videos: VideoRow[] };
      console.log("[debug][admin] videos fetched", data.videos?.length ?? 0);
      setVideos(data.videos ?? []);
    } else {
      console.error("[debug][admin] videos fetch failed", videosRes.status);
    }
    if (sessionsRes.ok) {
      const data = (await sessionsRes.json()) as {
        sessions: SessionRow[];
        activeCount: number;
        totalCount: number;
      };
      console.log("[debug][admin] sessions fetched", data.sessions?.length ?? 0);
      setSessions(data.sessions ?? []);
      setSessionCounts({ active: data.activeCount ?? 0, total: data.totalCount ?? 0 });
    } else {
      console.error("[debug][admin] sessions fetch failed", sessionsRes.status);
    }
    if (blogsRes.ok) {
      const data = (await blogsRes.json()) as { blogs: BlogRow[] };
      console.log("[debug][admin] blogs fetched", data.blogs?.length ?? 0);
      setBlogs(data.blogs ?? []);
    } else {
      console.error("[debug][admin] blogs fetch failed", blogsRes.status);
    }
  };

  const loadRoster = async () => {
    setRosterLoading(true);
    const res = await fetch("/api/admin/roster");
    if (res.ok) {
      const data = (await res.json()) as { managers: CaseManagerRow[]; practitioners: PractitionerRow[] };
      console.log("[debug][admin] roster fetched", {
        managers: data.managers?.length ?? 0,
        practitioners: data.practitioners?.length ?? 0,
      });
      setManagers(data.managers ?? []);
      setPractitioners(data.practitioners ?? []);
    } else {
      console.error("[debug][admin] roster fetch failed", res.status);
    }
    setRosterLoading(false);
  };

  const seedRoster = async () => {
    setRosterLoading(true);
    await fetch("/api/admin/roster/seed", { method: "POST" });
    await loadRoster();
    setActionMessage("Roster seeded with sample assignments.");
    setRosterLoading(false);
  };

  const handleRosterUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRosterLoading(true);
    setActionMessage(null);
    try {
      const payload = JSON.parse(rosterPayload) as {
        managers?: CaseManagerRow[];
        practitioners?: PractitionerRow[];
      };
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await res.text();
        setActionMessage(message || "Roster upload failed");
      } else {
        setActionMessage("Roster updated.");
        await loadRoster();
      }
    } catch (error) {
      setActionMessage("Invalid JSON payload.");
    }
    setRosterLoading(false);
  };

  const handleApprovePayment = async (caseId: string) => {
    await fetch("/api/admin/payments/approve", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    await loadDashboard();
  };

  const handleRevokeSession = async (sessionId: string) => {
    await fetch("/api/admin/sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "revoke" }),
    });
    await loadDashboard();
  };

  const handleAssignmentSave = async (row: CaseRow) => {
    const draft = assignmentDrafts[row.id] ?? {};
    const manager = managers.find((item) => item.id === draft.managerId);
    const practitioner = practitioners.find((item) => item.id === draft.practitionerId);

    await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: row.id,
        caseManager: manager,
        practitioner,
      }),
    });
    await loadDashboard();
  };

  const parseMeta = <T,>(value: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Login failed");
      return;
    }
    const data = (await res.json()) as { session: { email: string; displayName: string; role: string } };
    setSession(data.session);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Failed to create admin");
      setCreating(false);
      return;
    }
    await loadUsers();
    setCreating(false);
  };

  const handleCreateBlog = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const res = await fetch("/api/admin/blogs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blogDraft),
    });
    if (!res.ok) {
      const msg = await res.text();
      setActionMessage(msg || "Failed to create blog");
      return;
    }
    setActionMessage("Blog saved.");
    setBlogDraft((prev) => ({ ...prev, slug: "", content: prev.content }));
    await loadDashboard();
  };

  const handleSavePaymentPlan = async (row: CaseRow) => {
    const draft = paymentDrafts[row.id] ?? {};
    await fetch(`/api/cases/${row.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankInstructions: draft.bankInstructions ?? row.bankInstructions,
        paymentPlan: draft.paymentPlan ?? row.paymentPlan,
        terms: draft.terms ?? row.terms,
      }),
    });
    await loadDashboard();
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore and proceed with local reset
    }
    setSession(null);
    setCases([]);
    setClients([]);
    setDocuments([]);
    setVideos([]);
    setUsers([]);
  };

  useEffect(() => {
    if (session) {
      void loadUsers();
      void loadDashboard();
      void loadRoster();
    }
  }, [session]);

  useEffect(() => {
    const hydrate = async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        user: { fullName: string; email: string; role: string } | null;
      };
      if (!data.user) return;
      if (data.user.role !== "admin" && data.user.role !== "super-admin") return;
      setSession({
        email: data.user.email,
        displayName: data.user.fullName,
        role: data.user.role,
      });
    };
    void hydrate();
  }, []);

  const tabCases = cases.filter((row) => {
    const status = (row.caseStatus ?? "SUBMITTED") as CaseTab;
    if (caseTab === "IN_PROGRESS") return status === "IN_PROGRESS";
    if (caseTab === "PAYMENT_PENDING") return status === "PAYMENT_PENDING";
    if (caseTab === "AWAITING_CLIENT_APPROVAL") return status === "AWAITING_CLIENT_APPROVAL";
    if (caseTab === "UNDER_REVIEW") return status === "UNDER_REVIEW";
    return status === "SUBMITTED";
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className={clsx(cardShell, "p-6")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Admin Console</p>
                <h1 className="text-2xl font-semibold">NRI Law Buddy Control Center</h1>
              </div>
            </div>
            {session && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {!session ? (
          <form onSubmit={handleLogin} className={clsx(cardShell, "space-y-4 p-6")}
          >
            <h2 className="text-lg font-semibold">Administrator sign-in</h2>
            <label className="block text-sm text-slate-600">
              Email
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-600">
              Password
              <input
                type="password"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-50"
            >
              Sign in
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className={clsx(cardShell, "p-4")}>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Active cases</p>
                <p className="text-2xl font-semibold text-slate-900">{cases.length}</p>
                <p className="text-xs text-slate-500">Includes approved payments</p>
              </div>
              <div className={clsx(cardShell, "p-4")}>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Active sessions</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {sessionCounts.active} / {sessionCounts.total}
                </p>
                <p className="text-xs text-slate-500">Non-expired & not revoked</p>
              </div>
              <div className={clsx(cardShell, "p-4")}>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Registered users</p>
                <p className="text-2xl font-semibold text-slate-900">{clients.length}</p>
                <p className="text-xs text-slate-500">Client directory size</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
            <section className={clsx(cardShell, "p-6 lg:col-span-2")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active cases</h2>
                  <p className="text-sm text-slate-500">Latest engagement activity</p>
                </div>
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: "SUBMITTED", label: "New Cases" },
                  { key: "UNDER_REVIEW", label: "Under Review" },
                  { key: "AWAITING_CLIENT_APPROVAL", label: "Awaiting Client Approval" },
                  { key: "PAYMENT_PENDING", label: "Payment Queue" },
                  { key: "IN_PROGRESS", label: "Active" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCaseTab(tab.key as CaseTab)}
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      caseTab === tab.key
                        ? "bg-slate-900 text-amber-50"
                        : "border border-slate-200 text-slate-700"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {tabCases.length === 0 && (
                  <p className="text-sm text-slate-500">No cases in this lane.</p>
                )}
                {tabCases.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    {(() => {
                      const managerMeta = parseMeta<CaseManagerRow>(row.caseManagerMeta);
                      const practitionerMeta = parseMeta<PractitionerRow>(row.practitionerMeta);
                      const draft = assignmentDrafts[row.id] ?? {};
                      const selectedManagerId = draft.managerId ?? managerMeta?.id ?? "";
                      const selectedPractitionerId = draft.practitionerId ?? practitionerMeta?.id ?? "";
                      return (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{row.fullName}</p>
                              <p className="text-slate-500">
                                {row.email} • {row.country}
                              </p>
                            </div>
                            <div className="space-y-2 text-right">
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-900">
                                {(row.caseStatus ?? "SUBMITTED").replace(/_/g, " ")}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                                {row.stage}
                              </span>
                              <span
                                className={clsx(
                                  "block rounded-full px-3 py-1 text-xs",
                                  row.paymentStatus === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                )}
                              >
                                {row.paymentStatus === "approved" ? "Payment approved" : "Payment pending"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">
                            Service: {row.serviceId} • Docs: {row.documentCount} • Video: {row.videoSlot ?? "Pending"}
                          </p>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                          <p className="font-semibold text-slate-900">Case summary</p>
                          <p>{row.caseSummary || "Pending intake summary."}</p>
                          {row.caseDetails && (
                            <p className="mt-2 text-slate-500">Details: {row.caseDetails}</p>
                          )}
                          <div className="mt-3 space-y-2">
                            <label className="block text-[11px] text-slate-500">
                              Bank instructions
                              <textarea
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                                rows={2}
                                defaultValue={row.bankInstructions ?? ""}
                                onChange={(e) =>
                                  setPaymentDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...(prev[row.id] ?? {}), bankInstructions: e.target.value },
                                  }))
                                }
                              />
                            </label>
                            <label className="block text-[11px] text-slate-500">
                              Payment plan
                              <textarea
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                                rows={2}
                                defaultValue={row.paymentPlan ?? ""}
                                onChange={(e) =>
                                  setPaymentDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...(prev[row.id] ?? {}), paymentPlan: e.target.value },
                                  }))
                                }
                              />
                            </label>
                            <label className="block text-[11px] text-slate-500">
                              Terms
                              <textarea
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                                rows={2}
                                defaultValue={row.terms ?? ""}
                                onChange={(e) =>
                                  setPaymentDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...(prev[row.id] ?? {}), terms: e.target.value },
                                  }))
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleSavePaymentPlan(row)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-900/20 px-3 py-2 text-[11px] font-semibold text-slate-900"
                            >
                              Save payment instructions
                            </button>
                          </div>
                        </div>
                          {row.paymentStatus !== "approved" && (
                            <button
                              type="button"
                              onClick={() => void handleApprovePayment(row.id)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-900/20 px-3 py-2 text-xs font-semibold text-slate-900"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Approve payment
                            </button>
                          )}
                          <div className="grid gap-2 lg:grid-cols-2">
                            <label className="text-xs text-slate-500">
                              Case manager
                              <select
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs"
                                value={selectedManagerId}
                                onChange={(event) =>
                                  setAssignmentDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], managerId: event.target.value },
                                  }))
                                }
                              >
                                <option value="">Select manager</option>
                                {managers.map((manager) => (
                                  <option key={manager.id} value={manager.id}>
                                    {manager.name} • {manager.specialization}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs text-slate-500">
                              Practitioner
                              <select
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs"
                                value={selectedPractitionerId}
                                onChange={(event) =>
                                  setAssignmentDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], practitionerId: event.target.value },
                                  }))
                                }
                              >
                                <option value="">Select practitioner</option>
                                {practitioners.map((practitioner) => (
                                  <option key={practitioner.id} value={practitioner.id}>
                                    {practitioner.name} • {practitioner.focus}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleAssignmentSave(row)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-amber-50"
                          >
                            <ClipboardCheck className="h-4 w-4" /> Save assignment
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </section>
            <section className={clsx(cardShell, "p-6")}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Create admin user</h2>
              </div>
              <form onSubmit={handleCreate} className="mt-4 space-y-3">
                <label className="block text-sm text-slate-600">
                  Display name
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                    value={newUser.displayName}
                    onChange={(event) =>
                      setNewUser((prev) => ({ ...prev, displayName: event.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  Email
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                    value={newUser.email}
                    onChange={(event) =>
                      setNewUser((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  Role
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                    value={newUser.role}
                    onChange={(event) =>
                      setNewUser((prev) => ({ ...prev, role: event.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  Password
                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                    value={newUser.password}
                    onChange={(event) =>
                      setNewUser((prev) => ({ ...prev, password: event.target.value }))
                    }
                  />
                </label>
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-50 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create admin"}
                </button>
              </form>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className={clsx(cardShell, "p-6")}
            >
              <h2 className="text-lg font-semibold">Client directory</h2>
              <div className="mt-4 space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{client.fullName}</p>
                    <p className="text-slate-500">{client.email}</p>
                    <p className="text-xs text-slate-400">{client.country}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className={clsx(cardShell, "p-6")}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Vault documents</h2>
              </div>
              <div className="mt-4 space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.type} • {doc.status}</p>
                    <p className="text-xs text-slate-400">Case {doc.caseId}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className={clsx(cardShell, "p-6")}
            >
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Video schedule</h2>
              </div>
              <div className="mt-4 space-y-3">
                {videos.map((video) => (
                  <div key={video.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{video.scheduledAt}</p>
                    <p className="text-xs text-slate-500">Case {video.caseId}</p>
                    <a className="text-xs text-blue-600 underline" href={video.link}>
                      Join link
                    </a>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={clsx(cardShell, "space-y-4 p-6")}
          >
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Roster management</h2>
            </div>
            <p className="text-sm text-slate-500">
              Bulk upload case managers and practitioners or seed the sample roster.
            </p>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <form onSubmit={handleRosterUpload} className="space-y-3">
                <textarea
                  rows={8}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs"
                  value={rosterPayload}
                  onChange={(event) => setRosterPayload(event.target.value)}
                />
                {actionMessage && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {actionMessage}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={rosterLoading}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-amber-50 disabled:opacity-50"
                  >
                    {rosterLoading ? "Uploading..." : "Upload roster"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void seedRoster()}
                    className="rounded-2xl border border-slate-900/20 px-4 py-2 text-xs font-semibold text-slate-900"
                  >
                    Seed sample roster
                  </button>
                </div>
              </form>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">Case managers</p>
                  <ul className="mt-2 space-y-1">
                    {managers.map((manager) => (
                      <li key={manager.id}>
                        {manager.name} • {manager.specialization} • {manager.timezone}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">Practitioners</p>
                  <ul className="mt-2 space-y-1">
                    {practitioners.map((practitioner) => (
                      <li key={practitioner.id}>
                        {practitioner.name} • {practitioner.focus}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

            <section className={clsx(cardShell, "p-6")}
            >
              <h2 className="text-lg font-semibold">Admin users</h2>
              <p className="text-sm text-slate-500">Signed in as {session.displayName}</p>
              <div className="mt-4 space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{user.displayName}</p>
                    <p className="text-slate-500">{user.email}</p>
                    <p className="text-xs text-slate-400">Role: {user.role}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={clsx(cardShell, "p-6")}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active sessions</h2>
                  <p className="text-sm text-slate-500">Revoke to force re-login</p>
                </div>
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-4 space-y-3">
                {sessions.length === 0 && (
                  <p className="text-sm text-slate-500">No active sessions.</p>
                )}
                {sessions.map((s) => {
                  const expired = new Date(s.expiresAt).getTime() <= Date.now();
                  const revoked = Boolean(s.revokedAt);
                  return (
                    <div key={s.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{s.subjectEmail}</p>
                          <p className="text-xs text-slate-500">
                            Role: {s.role}
                            {s.actingAsRole ? ` → acting as ${s.actingAsRole}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">Expires: {s.expiresAt}</p>
                        </div>
                        <div className="space-y-1 text-right text-xs">
                          <span
                            className={clsx(
                              "inline-flex rounded-full px-3 py-1",
                              revoked || expired
                                ? "bg-slate-200 text-slate-600"
                                : "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {revoked ? "Revoked" : expired ? "Expired" : "Active"}
                          </span>
                          {!revoked && !expired && (
                            <button
                              type="button"
                              onClick={() => void handleRevokeSession(s.id)}
                              className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-900/20 px-3 py-1 text-[11px] font-semibold text-slate-900"
                            >
                              End session
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={clsx(cardShell, "p-6")}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Blog posts</h2>
                  <p className="text-sm text-slate-500">Create and publish static posts</p>
                </div>
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-4 space-y-3">
                {blogs.map((blog) => (
                  <div key={blog.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{blog.title}</p>
                    <p className="text-xs text-slate-500">/{blog.slug}</p>
                    <p className="text-xs text-slate-500">
                      {blog.published ? "Published" : "Draft"} • {blog.authorEmail}
                    </p>
                    {blog.excerpt && <p className="mt-1 text-sm text-slate-600">{blog.excerpt}</p>}
                  </div>
                ))}
                <form
                  onSubmit={handleCreateBlog}
                  className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm"
                >
                  <label className="block text-xs text-slate-500">
                    Title
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                      value={blogDraft.title}
                      onChange={(e) => setBlogDraft((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Slug (optional)
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                      value={blogDraft.slug}
                      onChange={(e) => setBlogDraft((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="auto-generated-from-title"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Excerpt
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                      value={blogDraft.excerpt}
                      onChange={(e) =>
                        setBlogDraft((prev) => ({ ...prev, excerpt: e.target.value }))
                      }
                      placeholder="Short summary"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Content (markdown/plaintext)
                    <textarea
                      rows={6}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                      value={blogDraft.content}
                      onChange={(e) =>
                        setBlogDraft((prev) => ({ ...prev, content: e.target.value }))
                      }
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={blogDraft.published}
                      onChange={(e) =>
                        setBlogDraft((prev) => ({ ...prev, published: e.target.checked }))
                      }
                    />
                    Publish immediately
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-amber-50"
                  >
                    Save blog
                  </button>
                </form>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
