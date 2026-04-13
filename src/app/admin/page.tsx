"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Globe2,
  LayoutDashboard,
  LogOut,
  Scale,
  Shield,
  ShieldCheck,
  Ticket,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

// ── Styles ──────────────────────────────────────────────────────────────────
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition";
const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500 transition";
const btnSmall =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 transition";

// ── Types ────────────────────────────────────────────────────────────────────
interface AdminUser { id: string; email: string; displayName: string; role: string; createdAt: string }
interface CaseRow {
  id: string; serviceId: string; stage: string;
  caseStatus?: string | null; stageStatus?: string | null;
  platformFeePaid: number; paymentStatus: string;
  caseDetails: string | null; caseSummary: string | null;
  caseManagerMeta: string | null; practitionerMeta: string | null;
  documentCount: number; videoSlot: string | null; updatedAt: string;
  fullName: string; email: string; country: string;
  bankInstructions?: string | null; paymentPlan?: string | null; terms?: string | null;
  paymentProofs?: string | null;  // JSON string of proof submissions
}
interface CaseManagerRow { id: string; name: string; timezone: string; specialization: string; weeklyLoad: number }
interface PractitionerRow { id: string; name: string; bar: string; focus: string }
interface ClientRow { id: string; fullName: string; email: string; country: string; createdAt: string }
interface DocumentRow { id: string; caseId: string; name: string; type: string; status: string; summary: string; uploadedAt: string }
interface VideoRow { id: string; caseId: string; scheduledAt: string; link: string; createdAt: string }
interface BlogRow { id: string; slug: string; title: string; excerpt?: string | null; content: string; authorEmail: string; published: boolean; createdAt: string }
interface SessionRow { id: string; subjectEmail: string; role: string; actingAsEmail?: string | null; actingAsRole?: string | null; expiresAt: string; revokedAt: string | null; createdAt: string }
type CaseTab = "SUBMITTED" | "PAYMENT_PENDING" | "AWAITING_ASSIGNMENT" | "IN_PROGRESS" | "CLOSED";
type AdminTab = "dashboard" | "cases" | "clients" | "roster" | "sessions" | "users" | "blogs" | "docs" | "videos";

// ── Root ─────────────────────────────────────────────────────────────────────
export default function AdminConsole() {
  const [session, setSession] = useState<{ email: string; displayName: string; role: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("dashboard");

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionCounts, setSessionCounts] = useState({ active: 0, total: 0 });
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [managers, setManagers] = useState<CaseManagerRow[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerRow[]>([]);

  const [caseTab, setCaseTab] = useState<CaseTab>("SUBMITTED");
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, { managerId?: string; practitionerId?: string }>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { bankInstructions?: string; paymentPlan?: string; terms?: string }>>({});

  const [rosterPayload, setRosterPayload] = useState(JSON.stringify({ managers: [{ id: "mgr-001", name: "Rhea Mehta", timezone: "IST", specialization: "Property & Title", weeklyLoad: 8 }], practitioners: [{ id: "prc-001", name: "Adv. Vikram Rao", bar: "Bombay High Court", focus: "Property litigation" }] }, null, 2));
  const [rosterLoading, setRosterLoading] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "admin", password: "" });
  const [blogDraft, setBlogDraft] = useState({ title: "", slug: "", excerpt: "", content: "", published: true });
  const [creating, setCreating] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const parseMeta = <T,>(v: string | null) => { if (!v) return null; try { return JSON.parse(v) as T; } catch { return null; } };

  const api = async (path: string, opts?: RequestInit) =>
    fetch(path, { credentials: "include", ...opts });

  const loadAll = async () => {
    const [casesR, clientsR, docsR, vidsR, sessR, blogsR] = await Promise.all([
      api("/api/admin/cases"),
      api("/api/admin/clients"),
      api("/api/admin/documents"),
      api("/api/admin/videos"),
      api("/api/admin/sessions"),
      api("/api/admin/blogs"),
    ]);
    if (casesR.ok) setCases(((await casesR.json()) as { cases: CaseRow[] }).cases ?? []);
    if (clientsR.ok) setClients(((await clientsR.json()) as { clients: ClientRow[] }).clients ?? []);
    if (docsR.ok) setDocuments(((await docsR.json()) as { documents: DocumentRow[] }).documents ?? []);
    if (vidsR.ok) setVideos(((await vidsR.json()) as { videos: VideoRow[] }).videos ?? []);
    if (sessR.ok) {
      const d = (await sessR.json()) as { sessions: SessionRow[]; activeCount: number; totalCount: number };
      setSessions(d.sessions ?? []); setSessionCounts({ active: d.activeCount ?? 0, total: d.totalCount ?? 0 });
    }
    if (blogsR.ok) setBlogs(((await blogsR.json()) as { blogs: BlogRow[] }).blogs ?? []);
  };

  const loadUsers = async () => {
    const r = await api("/api/admin/users");
    if (r.ok) setUsers(((await r.json()) as { users: AdminUser[] }).users ?? []);
  };

  const loadRoster = async () => {
    setRosterLoading(true);
    const r = await api("/api/admin/roster");
    if (r.ok) { const d = (await r.json()) as { managers: CaseManagerRow[]; practitioners: PractitionerRow[] }; setManagers(d.managers ?? []); setPractitioners(d.practitioners ?? []); }
    setRosterLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(null);
    const r = await api("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
    if (!r.ok) { setLoginError(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Login failed"); return; }
    const d = (await r.json()) as { session: { email: string; displayName: string; role: string } };
    setSession(d.session);
  };

  const handleSignOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    setSession(null); setCases([]); setClients([]); setDocuments([]); setVideos([]); setUsers([]);
  };

  const handleApprovePayment = async (caseId: string) => {
    await api("/api/admin/payments/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    await loadAll(); setActionMsg("Payment approved.");
  };

  const handleAssignment = async (row: CaseRow) => {
    const draft = assignmentDrafts[row.id] ?? {};
    await api("/api/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: row.id, caseManager: managers.find((m) => m.id === draft.managerId), practitioner: practitioners.find((p) => p.id === draft.practitionerId) }) });
    await loadAll(); setActionMsg("Assignment saved.");
  };

  const handleRevokeSession = async (id: string) => {
    await api("/api/admin/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, action: "revoke" }) });
    await loadAll();
  };

  const handleSavePaymentPlan = async (row: CaseRow) => {
    const d = paymentDrafts[row.id] ?? {};
    await api(`/api/cases/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankInstructions: d.bankInstructions ?? row.bankInstructions, paymentPlan: d.paymentPlan ?? row.paymentPlan, terms: d.terms ?? row.terms }) });
    await loadAll(); setActionMsg("Payment plan saved.");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true);
    const r = await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
    if (!r.ok) { setActionMsg(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Failed"); setCreating(false); return; }
    await loadUsers(); setCreating(false); setActionMsg("Admin user created."); setNewUser({ email: "", displayName: "", role: "admin", password: "" });
  };

  const handleRosterUpload = async (e: React.FormEvent) => {
    e.preventDefault(); setRosterLoading(true); setActionMsg(null);
    try {
      const payload = JSON.parse(rosterPayload) as object;
      const r = await api("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setActionMsg(r.ok ? "Roster updated." : await r.text()); if (r.ok) await loadRoster();
    } catch { setActionMsg("Invalid JSON."); }
    setRosterLoading(false);
  };

  const seedRoster = async () => { setRosterLoading(true); await api("/api/admin/roster/seed", { method: "POST" }); await loadRoster(); setActionMsg("Roster seeded."); setRosterLoading(false); };

  const handleCreateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/admin/blogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blogDraft) });
    setActionMsg(r.ok ? "Blog saved." : await r.text()); if (r.ok) { await loadAll(); setBlogDraft({ title: "", slug: "", excerpt: "", content: "", published: true }); }
  };

  useEffect(() => {
    if (session) { void loadAll(); void loadUsers(); void loadRoster(); }
  }, [session]);

  useEffect(() => {
    const hydrate = async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as { user: { fullName: string; email: string; role: string } | null };
      if (!d.user || (d.user.role !== "admin" && d.user.role !== "super-admin")) return;
      setSession({ email: d.user.email, displayName: d.user.fullName, role: d.user.role });
    };
    void hydrate();
  }, []);

  const tabCases = cases.filter((r) => {
    const s = (r.caseStatus ?? "SUBMITTED") as CaseTab;
    return s === caseTab;
  });

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "cases", label: "Cases", icon: <ClipboardList className="h-4 w-4" />, badge: cases.length },
    { id: "clients", label: "Clients", icon: <Users className="h-4 w-4" />, badge: clients.length },
    { id: "roster", label: "Roster", icon: <UserCheck className="h-4 w-4" /> },
    { id: "sessions", label: "Sessions", icon: <Shield className="h-4 w-4" />, badge: sessionCounts.active },
    { id: "users", label: "Admin Users", icon: <UserPlus className="h-4 w-4" /> },
    { id: "blogs", label: "Blogs", icon: <BookOpen className="h-4 w-4" /> },
    { id: "docs", label: "Documents", icon: <FileText className="h-4 w-4" />, badge: documents.length },
    { id: "videos", label: "Meetings", icon: <Video className="h-4 w-4" />, badge: videos.length },
  ];

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-lg border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">NRI Law Buddy</p>
              <p className="text-xs text-slate-400">Admin Console</p>
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={clsx("mt-1", inputCls)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={clsx("mt-1", inputCls)} required />
          </label>
          {loginError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{loginError}</div>}
          <button type="submit" className={clsx("w-full", btnPrimary)}>Sign in to console</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Admin Console</p>
            <p className="text-[11px] text-slate-400">NRI Law Buddy</p>
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900 truncate">{session.displayName}</p>
          <p className="text-xs text-slate-400 truncate">{session.email}</p>
          <span className="mt-1.5 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">{session.role}</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                tab === item.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}>
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold",
                  tab === item.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-4 py-4">
          <button type="button" onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-bold text-slate-900">{navItems.find((n) => n.id === tab)?.label}</h1>
          {actionMsg && (
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700 border border-emerald-200">
              {actionMsg}
              <button type="button" onClick={() => setActionMsg(null)} className="ml-3 text-xs text-emerald-500 underline">dismiss</button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6">

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div className="max-w-4xl space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total cases", value: cases.length, icon: <ClipboardList className="h-5 w-5 text-indigo-600" /> },
                  { label: "Active sessions", value: sessionCounts.active, icon: <Shield className="h-5 w-5 text-emerald-600" /> },
                  { label: "Registered clients", value: clients.length, icon: <Users className="h-5 w-5 text-blue-600" /> },
                  { label: "Documents", value: documents.length, icon: <FileText className="h-5 w-5 text-amber-600" /> },
                ].map((s) => (
                  <div key={s.label} className={clsx(card, "p-5")}>
                    <div className="flex items-center justify-between mb-2">{s.icon}<span className="text-3xl font-bold text-slate-900">{s.value}</span></div>
                    <p className="text-sm text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={clsx(card, "p-5")}>
                  <p className="text-sm font-semibold text-slate-900 mb-3">Recent cases</p>
                  {cases.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{c.fullName}</p>
                        <p className="text-xs text-slate-400">{c.serviceId} · {c.country}</p>
                      </div>
                      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium",
                        c.paymentStatus === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        {c.paymentStatus}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={clsx(card, "p-5")}>
                  <p className="text-sm font-semibold text-slate-900 mb-3">Upcoming meetings</p>
                  {videos.slice(0, 5).map((v) => (
                    <div key={v.id} className="py-2 border-b border-slate-100 last:border-0 text-sm">
                      <p className="font-medium text-slate-900">{v.scheduledAt}</p>
                      <p className="text-xs text-slate-400">Case: {v.caseId}</p>
                      <a href={v.link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">Join</a>
                    </div>
                  ))}
                  {videos.length === 0 && <p className="text-sm text-slate-400">No meetings scheduled.</p>}
                </div>
              </div>
            </div>
          )}

          {/* CASES */}
          {tab === "cases" && (
            <div className="max-w-5xl space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["SUBMITTED", "PAYMENT_PENDING", "AWAITING_ASSIGNMENT", "IN_PROGRESS", "CLOSED"] as CaseTab[]).map((t) => (
                  <button key={t} type="button" onClick={() => setCaseTab(t)}
                    className={clsx("rounded-full px-4 py-1.5 text-xs font-semibold transition",
                      caseTab === t ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:border-indigo-400")}>
                    {t.replace(/_/g, " ")} ({cases.filter((c) => (c.caseStatus ?? "SUBMITTED") === t).length})
                  </button>
                ))}
              </div>
              {tabCases.length === 0 && <p className="text-sm text-slate-400">No cases in this lane.</p>}
              {tabCases.map((row) => {
                const mgMeta = parseMeta<CaseManagerRow>(row.caseManagerMeta);
                const prMeta = parseMeta<PractitionerRow>(row.practitionerMeta);
                const draft = assignmentDrafts[row.id] ?? {};
                const paymentApproved = row.paymentStatus === "approved";
                const canAssign = paymentApproved;

                // Parse payment proofs
                let proofs: Array<{ id: string; submittedBy: string; submittedAt: string; url?: string; note?: string; approved?: boolean }> = [];
                try { proofs = row.paymentProofs ? JSON.parse(row.paymentProofs) as typeof proofs : []; } catch { proofs = []; }

                return (
                  <div key={row.id} className={clsx(card, "p-6 space-y-4")}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-slate-900">{row.fullName}</p>
                        <p className="text-sm text-slate-500">{row.email} · {row.country}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Service: {row.serviceId} · Docs: {row.documentCount} · Stage: {row.stage}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={clsx("rounded-full px-3 py-1 font-semibold",
                          paymentApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          Payment: {row.paymentStatus}
                        </span>
                        <span className={clsx("rounded-full px-3 py-1 text-slate-600",
                          (row.caseStatus ?? "") === "AWAITING_ASSIGNMENT" ? "bg-blue-100 text-blue-700 font-semibold" : "bg-slate-100")}>
                          {(row.caseStatus ?? "SUBMITTED").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {row.caseSummary && <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{row.caseSummary}</p>}
                    {row.caseDetails && <details className="text-xs text-slate-500"><summary className="cursor-pointer font-medium">Case brief</summary><p className="mt-1 whitespace-pre-line">{row.caseDetails}</p></details>}

                    {/* Payment proofs section — key admin task */}
                    {proofs.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                        <p className="text-sm font-semibold text-amber-900">Payment proofs submitted by client ({proofs.length})</p>
                        {proofs.map((p) => (
                          <div key={p.id} className="rounded-lg bg-white border border-amber-100 p-3 text-sm">
                            <p className="text-xs text-slate-400">{p.submittedBy} · {new Date(p.submittedAt).toLocaleString()}</p>
                            {p.url && <p className="text-indigo-700 mt-1 break-all font-medium">{p.url}</p>}
                            {p.note && <p className="text-slate-700 mt-1">{p.note}</p>}
                            <span className={clsx("mt-1 inline-flex rounded-full px-2 py-0.5 text-xs",
                              p.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {p.approved ? "Approved" : "Pending verification"}
                            </span>
                          </div>
                        ))}
                        {!paymentApproved && (
                          <button type="button" onClick={() => void handleApprovePayment(row.id)}
                            className={clsx(btnPrimary, "bg-emerald-600 hover:bg-emerald-700 w-full mt-2")}>
                            <CheckCircle2 className="h-4 w-4" /> Verify & approve payment → unlock assignment
                          </button>
                        )}
                        {paymentApproved && (
                          <p className="text-xs text-emerald-700 font-semibold">✓ Payment verified. You can now assign the legal team below.</p>
                        )}
                      </div>
                    )}
                    {proofs.length === 0 && !paymentApproved && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        No payment proof submitted yet. Client hasn&apos;t sent bank transfer details.
                        {row.paymentStatus !== "approved" && (
                          <button type="button" onClick={() => void handleApprovePayment(row.id)}
                            className={clsx("ml-3", btnSmall, "text-emerald-700 border-emerald-300 hover:border-emerald-500")}>
                            Force approve
                          </button>
                        )}
                      </div>
                    )}

                    {/* Bank instructions admin can set for client */}
                    <details className="rounded-xl border border-slate-200">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl">
                        Set bank & payment instructions for client
                      </summary>
                      <div className="px-4 pb-4 pt-2 space-y-2">
                        {[
                          { key: "bankInstructions", label: "Bank transfer instructions (shown to client)", placeholder: "Account: 1234567890\nIFSC: HDFC0001234\nName: NRI Law Buddy Escrow", rows: 3 },
                          { key: "paymentPlan", label: "Payment schedule", placeholder: "$50 platform fee due now. Balance on case filing.", rows: 2 },
                          { key: "terms", label: "Terms & conditions", placeholder: "All funds processed via platform.", rows: 2 },
                        ].map((f) => (
                          <label key={f.key} className="block text-xs font-medium text-slate-600">
                            {f.label}
                            <textarea rows={f.rows} className={clsx("mt-1", inputCls)}
                              defaultValue={(row[f.key as keyof CaseRow] as string) ?? ""}
                              placeholder={f.placeholder}
                              onChange={(e) => setPaymentDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], [f.key]: e.target.value } }))} />
                          </label>
                        ))}
                        <button type="button" onClick={() => void handleSavePaymentPlan(row)} className={btnSmall}>
                          Save & publish to client
                        </button>
                      </div>
                    </details>

                    {/* Assignments — only unlocked after payment approved */}
                    {canAssign ? (
                      <>
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-800 font-medium">
                          ✓ Payment approved — assign the legal team to activate all client features
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-medium text-slate-600">
                            Case manager
                            <select value={draft.managerId ?? mgMeta?.id ?? ""}
                              onChange={(e) => setAssignmentDrafts((p) => ({ ...p, [row.id]: { ...p[row.id], managerId: e.target.value } }))}
                              className={clsx("mt-1", inputCls)}>
                              <option value="">Select manager</option>
                              {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.specialization}</option>)}
                            </select>
                          </label>
                          <label className="block text-xs font-medium text-slate-600">
                            Lawyer / practitioner
                            <select value={draft.practitionerId ?? prMeta?.id ?? ""}
                              onChange={(e) => setAssignmentDrafts((p) => ({ ...p, [row.id]: { ...p[row.id], practitionerId: e.target.value } }))}
                              className={clsx("mt-1", inputCls)}>
                              <option value="">Select practitioner</option>
                              {practitioners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.focus}</option>)}
                            </select>
                          </label>
                        </div>
                        <button type="button" onClick={() => void handleAssignment(row)} className={btnPrimary}>
                          <ClipboardCheck className="h-4 w-4" /> Assign legal team → activate client
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        Verify &amp; approve payment above to unlock assignment.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CLIENTS */}
          {tab === "clients" && (
            <div className="max-w-4xl">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((c) => (
                  <div key={c.id} className={clsx(card, "p-5")}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold mb-3">
                      {c.fullName[0]?.toUpperCase()}
                    </div>
                    <p className="font-semibold text-slate-900">{c.fullName}</p>
                    <p className="text-sm text-slate-500">{c.email}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Globe2 className="h-3 w-3" /> {c.country}
                    </div>
                  </div>
                ))}
                {clients.length === 0 && <p className="text-sm text-slate-400 col-span-full">No clients yet.</p>}
              </div>
            </div>
          )}

          {/* ROSTER */}
          {tab === "roster" && (
            <div className="max-w-4xl space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <form onSubmit={handleRosterUpload} className={clsx(card, "p-6 space-y-4")}>
                  <h3 className="font-semibold text-slate-900">Upload roster (JSON)</h3>
                  <textarea rows={10} value={rosterPayload} onChange={(e) => setRosterPayload(e.target.value)} className={clsx(inputCls, "font-mono text-xs")} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={rosterLoading} className={btnPrimary}>
                      <UploadCloud className="h-4 w-4" /> {rosterLoading ? "Uploading…" : "Upload roster"}
                    </button>
                    <button type="button" onClick={() => void seedRoster()} className={btnOutline}>Seed sample</button>
                  </div>
                </form>
                <div className="space-y-4">
                  <div className={clsx(card, "p-5")}>
                    <p className="text-sm font-semibold text-slate-900 mb-3">Case managers ({managers.length})</p>
                    {managers.map((m) => (
                      <div key={m.id} className="py-2 border-b border-slate-100 last:border-0 text-sm">
                        <p className="font-medium text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.specialization} · {m.timezone} · Load: {m.weeklyLoad}</p>
                      </div>
                    ))}
                    {managers.length === 0 && <p className="text-xs text-slate-400">None loaded.</p>}
                  </div>
                  <div className={clsx(card, "p-5")}>
                    <p className="text-sm font-semibold text-slate-900 mb-3">Practitioners ({practitioners.length})</p>
                    {practitioners.map((p) => (
                      <div key={p.id} className="py-2 border-b border-slate-100 last:border-0 text-sm">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.bar} · {p.focus}</p>
                      </div>
                    ))}
                    {practitioners.length === 0 && <p className="text-xs text-slate-400">None loaded.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SESSIONS */}
          {tab === "sessions" && (
            <div className="max-w-4xl space-y-3">
              <p className="text-sm text-slate-500">{sessionCounts.active} active / {sessionCounts.total} total</p>
              {sessions.map((s) => {
                const expired = new Date(s.expiresAt).getTime() <= Date.now();
                const revoked = Boolean(s.revokedAt);
                return (
                  <div key={s.id} className={clsx(card, "p-4 flex items-center justify-between gap-3")}>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{s.subjectEmail}</p>
                      <p className="text-xs text-slate-400">Role: {s.role}{s.actingAsRole ? ` → ${s.actingAsRole}` : ""}</p>
                      <p className="text-xs text-slate-400">Expires: {new Date(s.expiresAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold",
                        revoked || expired ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")}>
                        {revoked ? "Revoked" : expired ? "Expired" : "Active"}
                      </span>
                      {!revoked && !expired && (
                        <button type="button" onClick={() => void handleRevokeSession(s.id)} className={btnSmall}>End</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {sessions.length === 0 && <p className="text-sm text-slate-400">No sessions found.</p>}
            </div>
          )}

          {/* ADMIN USERS */}
          {tab === "users" && (
            <div className="max-w-3xl space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {users.map((u) => (
                  <div key={u.id} className={clsx(card, "p-4")}>
                    <p className="font-semibold text-slate-900">{u.displayName}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                    <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{u.role}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleCreateUser} className={clsx(card, "p-6 space-y-4")}>
                <h3 className="font-semibold text-slate-900">Create admin user</h3>
                {[
                  { label: "Display name", key: "displayName", type: "text", placeholder: "Compliance Lead" },
                  { label: "Email", key: "email", type: "email", placeholder: "admin@org.com" },
                  { label: "Password", key: "password", type: "password", placeholder: "" },
                  { label: "Role", key: "role", type: "text", placeholder: "admin / super-admin" },
                ].map((f) => (
                  <label key={f.key} className="block text-sm font-medium text-slate-700">
                    {f.label}
                    <input type={f.type} value={newUser[f.key as keyof typeof newUser]} placeholder={f.placeholder}
                      onChange={(e) => setNewUser((p) => ({ ...p, [f.key]: e.target.value }))} className={clsx("mt-1", inputCls)} required />
                  </label>
                ))}
                <button type="submit" disabled={creating} className={btnPrimary}>{creating ? "Creating…" : "Create user"}</button>
              </form>
            </div>
          )}

          {/* BLOGS */}
          {tab === "blogs" && (
            <div className="max-w-4xl space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {blogs.map((b) => (
                  <div key={b.id} className={clsx(card, "p-4")}>
                    <p className="font-semibold text-slate-900">{b.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">/{b.slug}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium",
                        b.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                        {b.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    {b.excerpt && <p className="mt-2 text-sm text-slate-600">{b.excerpt}</p>}
                  </div>
                ))}
              </div>
              <form onSubmit={handleCreateBlog} className={clsx(card, "p-6 space-y-4")}>
                <h3 className="font-semibold text-slate-900">New blog post</h3>
                <label className="block text-sm font-medium text-slate-700">Title<input value={blogDraft.title} onChange={(e) => setBlogDraft((p) => ({ ...p, title: e.target.value }))} className={clsx("mt-1", inputCls)} required /></label>
                <label className="block text-sm font-medium text-slate-700">Slug (optional)<input value={blogDraft.slug} placeholder="auto-generated" onChange={(e) => setBlogDraft((p) => ({ ...p, slug: e.target.value }))} className={clsx("mt-1", inputCls)} /></label>
                <label className="block text-sm font-medium text-slate-700">Excerpt<input value={blogDraft.excerpt} onChange={(e) => setBlogDraft((p) => ({ ...p, excerpt: e.target.value }))} className={clsx("mt-1", inputCls)} /></label>
                <label className="block text-sm font-medium text-slate-700">Content<textarea rows={6} value={blogDraft.content} onChange={(e) => setBlogDraft((p) => ({ ...p, content: e.target.value }))} className={clsx("mt-1", inputCls)} required /></label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={blogDraft.published} onChange={(e) => setBlogDraft((p) => ({ ...p, published: e.target.checked }))} className="rounded" />
                  Publish immediately
                </label>
                <button type="submit" className={btnPrimary}>Save blog post</button>
              </form>
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === "docs" && (
            <div className="max-w-4xl space-y-3">
              {documents.map((d) => (
                <div key={d.id} className={clsx(card, "p-4 flex gap-4")}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 flex-shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{d.name}</p>
                      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium",
                        d.status === "ready" ? "bg-emerald-100 text-emerald-700" : d.status === "processing" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{d.type} · Case: {d.caseId}</p>
                    <p className="text-sm text-slate-600 mt-1">{d.summary}</p>
                  </div>
                </div>
              ))}
              {documents.length === 0 && <p className="text-sm text-slate-400">No documents yet.</p>}
            </div>
          )}

          {/* VIDEOS */}
          {tab === "videos" && (
            <div className="max-w-4xl space-y-3">
              {videos.map((v) => (
                <div key={v.id} className={clsx(card, "p-4 flex items-center justify-between gap-3")}>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{v.scheduledAt}</p>
                    <p className="text-xs text-slate-400">Case: {v.caseId}</p>
                  </div>
                  <a href={v.link} target="_blank" rel="noreferrer"
                    className={clsx(btnSmall, "text-indigo-600 border-indigo-200 hover:border-indigo-400")}>
                    <Video className="h-3.5 w-3.5" /> Join meeting
                  </a>
                </div>
              ))}
              {videos.length === 0 && <p className="text-sm text-slate-400">No meetings scheduled.</p>}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
