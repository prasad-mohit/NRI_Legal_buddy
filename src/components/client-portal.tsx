"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  FileUp,
  Fingerprint,
  FolderLock,
  Gavel,
  Globe2,
  HandCoins,
  LandPlot,
  Lock,
  LogOut,
  MessageSquare,
  PenSquare,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";
import { format } from "date-fns";

import { legalServices, serviceIconMap, type ServiceId } from "@/lib/services";
import { usePortalStore } from "@/store/usePortalStore";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition";
const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500 transition";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export function ClientPortal() {
  const user = usePortalStore((s) => s.user);
  const authRole = usePortalStore((s) => s.authRole);
  const hydrateAuthSession = usePortalStore((s) => s.hydrateAuthSession);

  useEffect(() => { void hydrateAuthSession(); }, [hydrateAuthSession]);
  useEffect(() => {
    if (authRole === "admin" || authRole === "super-admin") window.location.assign("/admin");
  }, [authRole]);

  if (!user) return <LandingPage />;
  return <PortalShell />;
}

// ---------------------------------------------------------------------------
// Landing (unauthenticated)
// ---------------------------------------------------------------------------
function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Scale className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">NRI Law Buddy</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowLogin(true)} className={btnOutline}>
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-100 opacity-60 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <Sparkles className="h-4 w-4" /> NRI Legal Command Center
          </span>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Cross-border legal<br />
            <span className="text-indigo-600">orchestrated for NRIs</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-500">
            Property disputes, FEMA compliance, probate, adoption — handled end-to-end by vetted Indian
            advocates with escrow controls and a transparent audit trail.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <SignupTrigger />
            <button type="button" onClick={() => setShowLogin(true)} className={btnOutline}>
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "37", label: "Global hubs" },
            { value: "220+", label: "Verified counsel" },
            { value: "05", label: "Escrow partners" },
            { value: "< 4 hrs", label: "Response SLA" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-3xl font-bold text-slate-900">Legal services we handle</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {legalServices.map((svc) => {
              const Icon = serviceIconMap[svc.id];
              return (
                <div key={svc.id} className={clsx(card, "p-5 transition hover:shadow-md")}>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-slate-900">{svc.label}</p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-3">{svc.summary}</p>
                  <p className="mt-2 text-xs text-indigo-600">{svc.turnaround}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signup panel (embedded in landing CTA)
// ---------------------------------------------------------------------------
function SignupTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        Get started — it&apos;s free <ChevronRight className="h-4 w-4" />
      </button>
      {open && <SignupModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SignupModal({ onClose }: { onClose: () => void }) {
  const startSignupOtp = usePortalStore((s) => s.startSignupOtp);
  const verifySignupOtp = usePortalStore((s) => s.verifySignupOtp);
  const authError = usePortalStore((s) => s.authError);
  const authLoading = usePortalStore((s) => s.authLoading);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"details" | "verify">("details");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (phase === "details") {
      const res = await startSignupOtp({ fullName, email, country, password });
      if (res) {
        setPhase("verify");
        setEmail(res.email);
        setTestOtp(res.testOtp ?? null);
        setNotice(`OTP sent. Expires in ${res.expiresInMinutes} min.`);
      }
      return;
    }
    const user = await verifySignupOtp({ email, otp });
    if (user) { setNotice("Verified! Loading workspace…"); setTimeout(onClose, 1000); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700">✕</button>
        </div>
        {phase === "details" ? (
          <>
            {[
              { label: "Full legal name", value: fullName, set: setFullName, type: "text", placeholder: "Arav Mehta" },
              { label: "Email", value: email, set: setEmail, type: "email", placeholder: "arav@example.com" },
              { label: "Country of residence", value: country, set: setCountry, type: "text", placeholder: "United States" },
            ].map((f) => (
              <label key={f.label} className="block text-sm font-medium text-slate-700">
                {f.label}
                <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder} required className={clsx("mt-1", inputCls)} />
              </label>
            ))}
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1">
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400"
                >{showPw ? "Hide" : "Show"}</button>
              </div>
            </label>
          </>
        ) : (
          <>
            <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Verification code
              <input value={otp} onChange={(e) => setOtp(e.target.value)}
                placeholder="000000" className={clsx("mt-1 tracking-widest", inputCls)} maxLength={6} />
            </label>
            {testOtp && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Dev OTP: <strong>{testOtp}</strong>
              </div>
            )}
          </>
        )}
        {authError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{authError}</div>}
        {notice && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
        <button type="submit" disabled={authLoading} className={clsx("w-full", btnPrimary)}>
          {authLoading ? "Please wait…" : phase === "details" ? "Continue" : "Verify & enter"}
          <Fingerprint className="h-4 w-4" />
        </button>
        {phase === "verify" && (
          <button type="button" onClick={() => { setPhase("details"); setOtp(""); }}
            className="w-full text-center text-xs text-slate-400 underline">Edit details</button>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login modal
// ---------------------------------------------------------------------------
function LoginModal({ onClose }: { onClose: () => void }) {
  const loginWithCredentials = usePortalStore((s) => s.loginWithCredentials);
  const authError = usePortalStore((s) => s.authError);
  const authLoading = usePortalStore((s) => s.authLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [notice, setNotice] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await loginWithCredentials({ email, password });
    if (res) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
              <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={clsx("mt-1", inputCls)} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1">
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400"
                >{showPw ? "Hide" : "Show"}</button>
              </div>
            </label>
            {notice && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
            {authError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{authError}</div>}
            <button type="submit" disabled={authLoading} className={clsx("w-full", btnPrimary)}>
              {authLoading ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" onClick={() => setMode("reset")} className="w-full text-center text-xs text-slate-400 underline">
              Forgot password?
            </button>
          </form>
        ) : (
          <PasswordResetFlow onBack={() => setMode("login")} onClose={onClose}
            onCompleted={() => { setMode("login"); setNotice("Password updated. Please sign in."); }} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------
function PasswordResetFlow(props: { onBack: () => void; onClose: () => void; onCompleted: () => void }) {
  const [phase, setPhase] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testOtp, setTestOtp] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await fetch("/api/auth/reset/start", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, newPassword }) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; testOtp?: string };
    if (!res.ok) { setError(data.message ?? "Unable to request reset"); setLoading(false); return; }
    setPhase("verify"); setTestOtp(data.testOtp ?? null); setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await fetch("/api/auth/reset/verify", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp }) });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) { setError(data.message ?? "Unable to verify"); setLoading(false); return; }
    setLoading(false); props.onCompleted();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Reset password</h2>
        <button type="button" onClick={props.onClose} className="text-sm text-slate-400">✕</button>
      </div>
      {phase === "request" ? (
        <form onSubmit={handleRequest} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={clsx("mt-1", inputCls)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={clsx("mt-1", inputCls)} />
          </label>
          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <button type="submit" disabled={loading} className={clsx("w-full", btnPrimary)}>{loading ? "Sending…" : "Send OTP"}</button>
          <button type="button" onClick={props.onBack} className="w-full text-center text-xs text-slate-400 underline">Back to sign in</button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">OTP code
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" className={clsx("mt-1", inputCls)} />
          </label>
          {testOtp && <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">Dev OTP: <strong>{testOtp}</strong></div>}
          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <button type="submit" disabled={loading} className={clsx("w-full", btnPrimary)}>{loading ? "Verifying…" : "Verify & reset"}</button>
          <button type="button" onClick={() => setPhase("request")} className="w-full text-center text-xs text-slate-400 underline">Request new code</button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portal shell (authenticated — sidebar + content)
// ---------------------------------------------------------------------------
type PortalSection = "dashboard" | "services" | "case" | "documents" | "meetings" | "escrow";

function PortalShell() {
  const user = usePortalStore((s) => s.user);
  const stage = usePortalStore((s) => s.stage);
  const caseStatus = usePortalStore((s) => s.caseStatus);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const logoutUser = usePortalStore((s) => s.logoutUser);
  const caseId = usePortalStore((s) => s.caseId);
  const refreshCaseStatus = usePortalStore((s) => s.refreshCaseStatus);
  const syncCases = usePortalStore((s) => s.syncCases);
  const [section, setSection] = useState<PortalSection>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (caseId) void refreshCaseStatus();
    else void syncCases();
  }, [caseId, refreshCaseStatus, syncCases]);

  const navItems: { id: PortalSection; label: string; icon: React.ReactNode; locked?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BadgeCheck className="h-4 w-4" /> },
    { id: "services", label: "Services", icon: <Gavel className="h-4 w-4" /> },
    { id: "case", label: "My Case", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, locked: !platformFeePaid },
    { id: "meetings", label: "Meetings", icon: <Video className="h-4 w-4" />, locked: !platformFeePaid },
    { id: "escrow", label: "Escrow", icon: <FolderLock className="h-4 w-4" />, locked: !platformFeePaid },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">NRI Law Buddy</p>
            <p className="text-[11px] text-slate-400">Client Portal</p>
          </div>
        </div>
        {/* User */}
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900 truncate">{user?.fullName}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">{user?.country}</span>
          </div>
        </div>
        {/* Case status badge */}
        {caseStatus && caseStatus !== "SUBMITTED" && (
          <div className="mx-4 mt-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            {caseStatus.replace(/_/g, " ")}
          </div>
        )}
        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.locked}
              onClick={() => setSection(item.id)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                section === item.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : item.locked
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.locked && <Lock className="h-3 w-3 opacity-60" />}
            </button>
          ))}
        </nav>
        {/* Sign out */}
        <div className="border-t border-slate-100 px-4 py-4">
          <button
            type="button"
            onClick={() => void logoutUser()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {navItems.find((n) => n.id === section)?.label}
            </h1>
            <p className="text-xs text-slate-400">
              {stage !== "login" ? `Stage: ${stage.replace(/-/g, " ")}` : "Welcome back"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {platformFeePaid && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fee approved
              </span>
            )}
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === "dashboard" && <DashboardView onNavigate={setSection} />}
          {section === "services" && <ServiceCatalog />}
          {section === "case" && <CaseView />}
          {section === "documents" && <DocumentVault />}
          {section === "meetings" && <VideoScheduler />}
          {section === "escrow" && <EscrowTracker />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function DashboardView({ onNavigate }: { onNavigate: (s: PortalSection) => void }) {
  const user = usePortalStore((s) => s.user);
  const caseStatus = usePortalStore((s) => s.caseStatus);
  const selectedService = usePortalStore((s) => s.selectedService);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const paymentCaptured = usePortalStore((s) => s.paymentCaptured);
  const paymentStatus = usePortalStore((s) => s.paymentStatus);
  const timeline = usePortalStore((s) => s.timeline);
  const assignedCaseManager = usePortalStore((s) => s.assignedCaseManager);
  const assignedPractitioner = usePortalStore((s) => s.assignedPractitioner);
  const videoCall = usePortalStore((s) => s.videoCall);
  const assurance = usePortalStore((s) => s.assurance);

  const steps = [
    { id: "services", label: "Select legal service", done: Boolean(selectedService), icon: <Gavel className="h-4 w-4" /> },
    { id: "services", label: "Platform fee paid", done: platformFeePaid || paymentCaptured, icon: <CreditCard className="h-4 w-4" /> },
    { id: "case", label: "Case manager assigned", done: Boolean(assignedCaseManager), icon: <UserCheck className="h-4 w-4" /> },
    { id: "case", label: "Practitioner assigned", done: Boolean(assignedPractitioner), icon: <Scale className="h-4 w-4" /> },
    { id: "meetings", label: "Video consult scheduled", done: Boolean(videoCall), icon: <Video className="h-4 w-4" /> },
  ] as const;

  const paymentBanner = paymentCaptured && !platformFeePaid
    ? { type: "warning", text: "Payment captured — awaiting admin approval." }
    : !paymentCaptured && !platformFeePaid && selectedService
      ? { type: "info", text: "Complete the $50 platform fee to unlock your case." }
      : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome */}
      <div className={clsx(card, "p-6")}>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-bold flex-shrink-0">
            {user?.fullName?.[0]?.toUpperCase() ?? "C"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Hello, {user?.fullName?.split(" ")[0]} 👋</h2>
            <p className="text-sm text-slate-500 mt-1">
              {selectedService ? `Service: ${selectedService.label}` : "Select a legal service to begin your case journey."}
            </p>
            {caseStatus && (
              <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {caseStatus.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {paymentBanner && (
        <div className={clsx(
          "rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2",
          paymentBanner.type === "warning"
            ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "bg-blue-50 text-blue-800 border border-blue-200"
        )}>
          {paymentBanner.type === "warning" ? <HandCoins className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          {paymentBanner.text}
        </div>
      )}

      {/* Progress checklist */}
      <div className={clsx(card, "p-6")}>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Case journey progress</h3>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onNavigate(step.id as PortalSection)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-left transition",
                step.done
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-400"
              )}
            >
              <div className={clsx("flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0",
                step.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
              </div>
              <span className="font-medium">{step.label}</span>
              {!step.done && <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Assignments */}
      {(assignedCaseManager || assignedPractitioner) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignedCaseManager && (
            <div className={clsx(card, "p-5")}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Case Manager</p>
              <p className="font-semibold text-slate-900">{assignedCaseManager.name}</p>
              <p className="text-sm text-slate-500">{assignedCaseManager.specialization}</p>
              <p className="text-xs text-slate-400 mt-1">{assignedCaseManager.timezone}</p>
            </div>
          )}
          {assignedPractitioner && (
            <div className={clsx(card, "p-5")}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Practitioner</p>
              <p className="font-semibold text-slate-900">{assignedPractitioner.name}</p>
              <p className="text-sm text-slate-500">{assignedPractitioner.bar}</p>
              <p className="text-xs text-slate-400 mt-1">{assignedPractitioner.focus}</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance notes */}
      <div className={clsx(card, "p-5")}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Compliance guardrails</h3>
        </div>
        <ul className="space-y-2">
          {assurance.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Recent timeline */}
      {timeline.length > 0 && (
        <div className={clsx(card, "p-5")}>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent activity</h3>
          <div className="space-y-2">
            {timeline.slice(-4).reverse().map((evt) => (
              <div key={evt.id} className="flex gap-3 text-sm">
                <div className={clsx("mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                  evt.status === "live" ? "bg-indigo-500" : "bg-slate-300")} />
                <div>
                  <p className="font-medium text-slate-900">{evt.title}</p>
                  <p className="text-xs text-slate-500">{evt.timestamp} · {evt.actor}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service catalog
// ---------------------------------------------------------------------------
function ServiceCatalog() {
  const selectedService = usePortalStore((s) => s.selectedService);
  const selectService = usePortalStore((s) => s.selectService);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const paymentCaptured = usePortalStore((s) => s.paymentCaptured);
  const paymentActionState = usePortalStore((s) => s.paymentActionState);
  const paymentActionMessage = usePortalStore((s) => s.paymentActionMessage);
  const caseId = usePortalStore((s) => s.caseId);
  const capturePlatformFee = usePortalStore((s) => s.capturePlatformFee);
  const setCaseDetailsDraft = usePortalStore((s) => s.setCaseDetailsDraft);
  const submitCaseDetails = usePortalStore((s) => s.submitCaseDetails);
  const caseDetails = usePortalStore((s) => s.caseDetails ?? "");
  const [saving, setSaving] = useState(false);

  const feeDisabled = !selectedService || platformFeePaid || paymentActionState === "loading";
  const feeLabel =
    paymentActionState === "loading" ? "Opening checkout…" :
    platformFeePaid ? "Fee approved ✓" :
    paymentCaptured ? "Awaiting admin approval" :
    caseId ? "Retry $50 fee" : "Pay $50 platform fee";

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await submitCaseDetails(caseDetails); setSaving(false);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Select your legal service</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">Choose the mandate that matches your situation. You can change it before paying.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {legalServices.map((svc) => {
            const Icon = serviceIconMap[svc.id];
            const active = selectedService?.id === svc.id;
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => selectService(svc.id)}
                className={clsx(
                  "rounded-2xl border p-4 text-left transition hover:shadow-md",
                  active
                    ? "border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-200"
                    : "border-slate-200 bg-white hover:border-indigo-300"
                )}
              >
                <div className={clsx("mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl",
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className={clsx("text-sm font-semibold", active ? "text-indigo-900" : "text-slate-900")}>{svc.label}</p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{svc.summary}</p>
                <p className={clsx("mt-2 text-xs font-medium", active ? "text-indigo-600" : "text-slate-400")}>{svc.turnaround}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedService && (
        <div className={clsx(card, "p-6 border-indigo-100")}>
          <h3 className="font-semibold text-slate-900 mb-1">{selectedService.label}</h3>
          <p className="text-sm text-slate-500 mb-3">{selectedService.complianceNote}</p>
          <ul className="grid gap-2 sm:grid-cols-2 mb-4">
            {selectedService.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Case brief */}
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-4">
          <PenSquare className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Brief your case</h3>
        </div>
        <form onSubmit={handleDetails} className="space-y-3">
          <textarea
            rows={4}
            value={caseDetails}
            onChange={(e) => setCaseDetailsDraft(e.target.value)}
            placeholder="Describe your situation: property address, key dates, current disputes…"
            className={inputCls}
          />
          <button type="submit" disabled={saving || !caseDetails.trim()} className={btnPrimary}>
            {saving ? "Saving…" : "Save brief"}
          </button>
        </form>
      </div>

      {/* Fee payment */}
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Platform fee — $50</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          One-time flat fee to activate your case manager, escrow ledger, and document vault.
          Handled securely via Razorpay — no fee negotiation outside the platform.
        </p>
        {paymentActionMessage && (
          <div className={clsx("mb-3 rounded-xl px-4 py-3 text-sm",
            paymentActionState === "error"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : paymentActionState === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
          )}>
            {paymentActionMessage}
          </div>
        )}
        <button
          type="button"
          disabled={feeDisabled}
          onClick={() => void capturePlatformFee()}
          className={clsx(btnPrimary, "disabled:opacity-40")}
        >
          <HandCoins className="h-4 w-4" /> {feeLabel}
        </button>
        {!platformFeePaid && (
          <p className="mt-3 text-xs text-slate-400">
            <Shield className="inline h-3.5 w-3.5 mr-1" />
            All billing is platform-controlled. Never share any fees outside NRI Law Buddy.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case view (timeline + intake + assignments + payment schedule)
// ---------------------------------------------------------------------------
function CaseView() {
  const caseStatus = usePortalStore((s) => s.caseStatus);
  const timeline = usePortalStore((s) => s.timeline);
  const assignedCaseManager = usePortalStore((s) => s.assignedCaseManager);
  const assignedPractitioner = usePortalStore((s) => s.assignedPractitioner);
  const caseSummary = usePortalStore((s) => s.caseSummary);
  const paymentPlan = usePortalStore((s) => s.paymentPlan);
  const bankInstructions = usePortalStore((s) => s.bankInstructions);
  const terms = usePortalStore((s) => s.terms);
  const submitPaymentProof = usePortalStore((s) => s.submitPaymentProof);
  const paymentProofs = usePortalStore((s) => s.paymentProofs ?? []);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const paymentCaptured = usePortalStore((s) => s.paymentCaptured);
  const caseId = usePortalStore((s) => s.caseId);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleProof = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true);
    await submitPaymentProof({ url: url || undefined, note: note || undefined });
    setSending(false); setUrl(""); setNote("");
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Status banner */}
      {caseStatus && (
        <div className={clsx(card, "px-5 py-4 flex items-center gap-3")}>
          <BadgeCheck className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Case status: <span className="text-indigo-700">{caseStatus.replace(/_/g, " ")}</span></p>
            {caseSummary && <p className="text-xs text-slate-500 mt-0.5">{caseSummary}</p>}
          </div>
        </div>
      )}

      {/* Assignments */}
      {(assignedCaseManager || assignedPractitioner) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignedCaseManager && (
            <div className={clsx(card, "p-5")}>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Case Manager</p>
              <p className="font-semibold text-slate-900">{assignedCaseManager.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{assignedCaseManager.specialization}</p>
              <p className="text-xs text-slate-400 mt-1">{assignedCaseManager.timezone} · Load: {assignedCaseManager.weeklyLoad}/wk</p>
            </div>
          )}
          {assignedPractitioner && (
            <div className={clsx(card, "p-5")}>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Practitioner</p>
              <p className="font-semibold text-slate-900">{assignedPractitioner.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{assignedPractitioner.bar}</p>
              <p className="text-xs text-slate-400 mt-1">{assignedPractitioner.focus}</p>
            </div>
          )}
        </div>
      )}

      {/* Payment plan */}
      {(bankInstructions || paymentPlan || terms || (!platformFeePaid && paymentCaptured)) && (
        <div className={clsx(card, "p-6 space-y-4")}>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Payment instructions</h3>
          </div>
          {bankInstructions && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold mb-1">Bank instructions</p>
              <p className="whitespace-pre-line">{bankInstructions}</p>
            </div>
          )}
          {paymentPlan && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-line">
              <p className="font-semibold text-slate-900 mb-1">Payment plan</p>
              {paymentPlan}
            </div>
          )}
          {terms && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-line">
              <p className="font-semibold text-slate-900 mb-1">Terms & conditions</p>
              {terms}
            </div>
          )}
          {!platformFeePaid && caseId && (
            <form onSubmit={handleProof} className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-slate-900">Submit payment proof</p>
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="Reference link or UTR number" className={inputCls} />
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                rows={2} placeholder="Notes (bank, date, amount)" className={inputCls} />
              <button type="submit" disabled={sending || (!url && !note)} className={btnPrimary}>
                {sending ? "Submitting…" : "Submit proof"} <FileUp className="h-4 w-4" />
              </button>
            </form>
          )}
          {paymentProofs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Submitted proofs</p>
              {paymentProofs.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="text-xs text-slate-400">{p.submittedBy} · {new Date(p.submittedAt).toLocaleString()}</p>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline block mt-1">{p.url}</a>}
                  {p.note && <p className="text-slate-700 mt-1">{p.note}</p>}
                  <span className={clsx("mt-1 inline-flex rounded-full px-2 py-0.5 text-xs",
                    p.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {p.approved ? "Approved" : "Pending review"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className={clsx(card, "p-6")}>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Case timeline</h3>
          </div>
          <ol className="relative border-l border-slate-200 space-y-5 ml-2">
            {timeline.map((evt) => (
              <li key={evt.id} className="ml-4">
                <div className={clsx(
                  "absolute -left-1.5 h-3 w-3 rounded-full border-2 border-white",
                  evt.status === "live" ? "bg-indigo-500" : evt.status === "done" ? "bg-emerald-500" : "bg-slate-300"
                )} />
                <div className={clsx("rounded-xl border p-3 text-sm",
                  evt.status === "live" ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"
                )}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{evt.title}</p>
                    <span className="text-xs text-slate-400">{evt.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{evt.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{evt.actor}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!caseId && (
        <div className={clsx(card, "px-6 py-10 text-center text-slate-500")}>
          <p className="text-sm">No active case yet. Select a service and complete the platform fee to get started.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document vault
// ---------------------------------------------------------------------------
function DocumentVault() {
  const documents = usePortalStore((s) => s.documents);
  const addDocument = usePortalStore((s) => s.addDocument);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const [name, setName] = useState("");
  const [type, setType] = useState("Identity");
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="max-w-4xl space-y-6">
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-1">
          <FolderLock className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Document vault</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          AES-256 encrypted. Practitioners see only summaries unless explicit access is granted by the platform.
        </p>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className={clsx(card, "p-4 flex gap-4")}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm truncate">{doc.name}</p>
                  <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
                    doc.status === "ready" ? "bg-emerald-100 text-emerald-700" :
                    doc.status === "processing" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600")}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{doc.type} · {format(new Date(doc.updatedAt), "dd MMM, HH:mm")}</p>
                <p className="text-sm text-slate-600 mt-1">{doc.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={clsx(card, "p-6")}>
        <h3 className="font-semibold text-slate-900 mb-4">Upload document</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); void addDocument(name, type, fileName ?? undefined); setName(""); setFileName(null); }}
          className="space-y-3"
        >
          <input type="file" disabled={!platformFeePaid} onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-50" />
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!platformFeePaid}
            placeholder="Document name" className={inputCls} />
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!platformFeePaid} className={inputCls}>
            {["Identity", "Authority", "Litigation", "Compliance", "Financial", "Other"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button type="submit" disabled={!platformFeePaid || !name.trim()} className={btnPrimary}>
            <FileUp className="h-4 w-4" /> Add to vault
          </button>
          {!platformFeePaid && <p className="text-xs text-slate-400">Vault uploads unlock after fee approval.</p>}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video scheduler
// ---------------------------------------------------------------------------
function VideoScheduler() {
  const videoCall = usePortalStore((s) => s.videoCall);
  const scheduleVideoCall = usePortalStore((s) => s.scheduleVideoCall);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);
  const [slot, setSlot] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault(); setScheduling(true);
    await scheduleVideoCall(slot); setScheduling(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-1">
          <Video className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Video consultation</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Secure end-to-end encrypted video via Jitsi Meet. No downloads required — works in any modern browser.
        </p>

        {videoCall ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-emerald-800 mb-2">
                <CalendarCheck className="h-5 w-5" />
                <p className="font-semibold">Consultation confirmed</p>
              </div>
              <p className="text-sm text-emerald-700">{videoCall.scheduledAt}</p>
              <p className="text-xs text-emerald-600 mt-1">Provider: {videoCall.provider}</p>
            </div>
            <a
              href={videoCall.link}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(btnPrimary, "w-full justify-center")}
            >
              <Video className="h-4 w-4" /> Join consultation
            </a>
            <p className="text-xs text-slate-400 text-center">The link opens in a new tab via Jitsi Meet.</p>
          </div>
        ) : (
          <form onSubmit={handleSchedule} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Preferred date & time
              <input
                type="datetime-local"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                disabled={!platformFeePaid}
                className={clsx("mt-1", inputCls)}
              />
            </label>
            <button
              type="submit"
              disabled={!platformFeePaid || scheduling || !slot}
              className={clsx(btnPrimary, "w-full")}
            >
              <CalendarCheck className="h-4 w-4" />
              {scheduling ? "Scheduling…" : "Schedule consultation"}
            </button>
            {!platformFeePaid && (
              <p className="text-xs text-slate-400 text-center">
                Meeting scheduling unlocks after the platform fee is approved.
              </p>
            )}
          </form>
        )}
      </div>

      <div className={clsx(card, "p-5 text-sm text-slate-600")}>
        <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-600" /> How meetings work
        </p>
        <ul className="space-y-1.5">
          {[
            "A unique encrypted room is created for each consultation.",
            "Video is peer-to-peer — NRI Law Buddy does not record calls.",
            "Both client and practitioner receive the same join link.",
            "If you miss a meeting, a new slot can be scheduled from this page.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escrow tracker
// ---------------------------------------------------------------------------
function EscrowTracker() {
  const milestones = usePortalStore((s) => s.escrowMilestones);
  const advanceEscrow = usePortalStore((s) => s.advanceEscrow);
  const platformFeePaid = usePortalStore((s) => s.platformFeePaid);

  const released = milestones.filter((m) => m.unlocked).reduce((sum, m) => sum + m.amountPct, 0);
  const total = 100;
  const pct = Math.min(100, released);

  return (
    <div className="max-w-2xl space-y-6">
      <div className={clsx(card, "p-6")}>
        <div className="flex items-center gap-2 mb-1">
          <FolderLock className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Escrow governance</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Funds are held at an Indian Bank partner. 60% is released on court filing, 40% on case listing.
          The platform never allows bypass outside escrow.
        </p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
            <span>Released</span>
            <span className="text-indigo-700">{released}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div key={m.id} className={clsx(
              "rounded-2xl border p-4 flex items-start gap-3",
              m.unlocked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            )}>
              <div className={clsx("mt-0.5 flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-xs font-bold",
                m.unlocked ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>
                {m.unlocked ? "✓" : idx + 1}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">{m.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                {m.amountPct > 0 && (
                  <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                    Releases {m.amountPct}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!platformFeePaid}
          onClick={() => void advanceEscrow()}
          className={clsx("mt-6 w-full", btnOutline, "disabled:opacity-40")}
        >
          <HandCoins className="h-4 w-4 text-emerald-600" /> Proceed escrow workflow
        </button>
        {!platformFeePaid && (
          <p className="mt-2 text-xs text-center text-slate-400">Escrow actions unlock after fee approval.</p>
        )}
      </div>
    </div>
  );
}
