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

export default function AdminConsole() {
  const [email, setEmail] = useState("admin@nri-law-buddy.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [session, setSession] = useState<{ email: string; displayName: string; role: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
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
    const res = await fetch("/api/admin/users");
    if (!res.ok) return;
    const data = (await res.json()) as { users: AdminUser[] };
    setUsers(data.users ?? []);
  };

  const loadDashboard = async () => {
    const [casesRes, clientsRes, docsRes, videosRes] = await Promise.all([
      fetch("/api/admin/cases"),
      fetch("/api/admin/clients"),
      fetch("/api/admin/documents"),
      fetch("/api/admin/videos"),
    ]);

    if (casesRes.ok) {
      const data = (await casesRes.json()) as { cases: CaseRow[] };
      setCases(data.cases ?? []);
    }
    if (clientsRes.ok) {
      const data = (await clientsRes.json()) as { clients: ClientRow[] };
      setClients(data.clients ?? []);
    }
    if (docsRes.ok) {
      const data = (await docsRes.json()) as { documents: DocumentRow[] };
      setDocuments(data.documents ?? []);
    }
    if (videosRes.ok) {
      const data = (await videosRes.json()) as { videos: VideoRow[] };
      setVideos(data.videos ?? []);
    }
  };

  const loadRoster = async () => {
    setRosterLoading(true);
    const res = await fetch("/api/admin/roster");
    if (res.ok) {
      const data = (await res.json()) as { managers: CaseManagerRow[]; practitioners: PractitionerRow[] };
      setManagers(data.managers ?? []);
      setPractitioners(data.practitioners ?? []);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const message = await res.text();
      setError(message || "Login failed");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (!res.ok) {
      const message = await res.text();
      setError(message || "Failed to create admin");
      setCreating(false);
      return;
    }
    await loadUsers();
    setCreating(false);
  };

  useEffect(() => {
    if (session) {
      void loadUsers();
      void loadDashboard();
      void loadRoster();
    }
  }, [session]);

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
                onClick={() => setSession(null)}
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
              <div className="mt-4 space-y-3">
                {cases.map((row) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
