"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Camera,
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
  PhoneCall,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wifi,
  Video,
} from "lucide-react";
import { format } from "date-fns";

import { legalServices, serviceIconMap, type ServiceId } from "@/lib/services";
import { usePortalStore } from "@/store/usePortalStore";

const cardShell =
  "rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.08)]";

export function ClientPortal() {
  const user = usePortalStore((state) => state.user);
  const authRole = usePortalStore((state) => state.authRole);
  const hydrateAuthSession = usePortalStore((state) => state.hydrateAuthSession);

  useEffect(() => {
    void hydrateAuthSession();
  }, [hydrateAuthSession]);

  useEffect(() => {
    if (authRole === "admin" || authRole === "super-admin") {
      window.location.assign("/admin");
    }
  }, [authRole]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <TopBar />
        {user ? (
          <div className="mt-6">
            <PortalWorkspace />
          </div>
        ) : (
          <>
            <HeroBanner loggedIn={false} />
            <div className="mt-8">
              <SignupSection />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar() {
  const [open, setOpen] = useState(false);
  const user = usePortalStore((state) => state.user);
  const logoutUser = usePortalStore((state) => state.logoutUser);

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-amber-50">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">NRI Law Buddy</p>
          <p className="text-lg font-semibold text-slate-900">Client access portal</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <button
            type="button"
            onClick={() => void logoutUser()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Log in
          </button>
        )}
      </div>
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function HeroBanner({ loggedIn }: { loggedIn: boolean }) {
  const stats = [
    { label: "Global hubs", value: "37", detail: "24x7 coverage" },
    { label: "Verified counsel", value: "220+", detail: "High Court empanelled" },
    { label: "Escrow partners", value: "05", detail: "Regulated institutions" },
    { label: "Response SLA", value: "< 4 hrs", detail: "Initial intake" },
  ];

  const focusAreas = [
    { Icon: LandPlot, label: "Property & title" },
    { Icon: Scale, label: "Litigation & escrow" },
    { Icon: Gavel, label: "Probate & estate" },
    { Icon: Globe2, label: "Cross-border advisory" },
  ];

  return (
    <header className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-800 px-6 py-10 text-amber-50 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-amber-400 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-blue-300 blur-3xl" />
      </div>
      <div className="relative z-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-4 py-1 text-sm font-medium text-amber-100">
            <Sparkles className="h-4 w-4" /> Global NRI legal command center
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
            Cross-border legal ops, escrow, and counsel — orchestrated in one portal.
          </h1>
          <p className="text-lg text-slate-100/80">
            Case managers, vetted advocates, escrow compliance, and secure document intelligence
            delivered in a single, auditable workspace.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-100/90">
            {focusAreas.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1"
              >
                <Icon className="h-4 w-4 text-amber-200" />
                {label}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-100/70">
            {loggedIn
              ? "You are signed in. Continue the workflow modules below."
              : "Authenticate below to access your secure client workspace."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-white/10 bg-white/10 p-5 text-center shadow-inner backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">{metric.label}</p>
              <p className="text-3xl font-semibold text-white">{metric.value}</p>
              <p className="text-xs text-amber-100/80">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function SignupSection() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className={clsx(cardShell, "space-y-6 p-8 lg:p-10")}>
        <h2 className="text-2xl font-semibold">How the engagement works</h2>
        <ol className="space-y-4 text-sm text-slate-600">
          {[
            "Sign in with verified email and country so we route you to the correct NRI desk.",
            "Select the legal mandate (property, FEMA compliance, custody, probate, and more).",
            "Pay the flat $50 platform fee to activate your case manager and escrow ledger.",
            "Track assignments, video consultations, and escrow releases in one audited feed.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/90 text-sm font-semibold text-blue-100">
                {index + 1}
              </span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <ShieldCheck className="mr-2 inline h-4 w-4" />
          All billing remains inside the platform with escrow controls and invoice trails.
        </div>
      </div>
      <SignupPanel />
    </section>
  );
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const loginWithCredentials = usePortalStore((state) => state.loginWithCredentials);
  const authError = usePortalStore((state) => state.authError);
  const authLoading = usePortalStore((state) => state.authLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [notice, setNotice] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await loginWithCredentials({ email, password });
    if (result) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-blue-900/60 px-4 backdrop-blur">
      <div
        className={clsx(
          "w-full max-w-md space-y-4 overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]",
          "backdrop-blur"
        )}
      >
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Log in</h3>
              <button type="button" onClick={onClose} className="text-sm text-slate-400">
                Close
              </button>
            </div>
            <label className="block text-sm text-slate-300">
              Email
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input
                type={showPassword ? "text" : "password"}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="mt-1 text-xs text-amber-200 underline"
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </label>
            {authError && (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {authError}
              </div>
            )}
            {notice && (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                {notice}
              </div>
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 disabled:opacity-50"
            >
              {authLoading ? "Signing in..." : "Log in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setNotice(null);
              }}
              className="text-xs text-slate-400 underline"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <PasswordResetFlow
            onBack={() => setMode("login")}
            onClose={onClose}
            onCompleted={() => {
              setMode("login");
              setNotice("Password updated. Please sign in with your new password.");
            }}
          />
        )}
      </div>
    </div>
  );
}

function PasswordResetFlow(props: {
  onBack: () => void;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [phase, setPhase] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testOtp, setTestOtp] = useState<string | null>(null);

  const handleRequestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/reset/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; testOtp?: string };
    if (!res.ok) {
      setError(data.message ?? "Unable to start password reset");
      setLoading(false);
      return;
    }
    setPhase("verify");
    setTestOtp(data.testOtp ?? null);
    setLoading(false);
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setError(data.message ?? "Unable to verify reset code");
      setLoading(false);
      return;
    }
    setLoading(false);
    props.onCompleted();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reset password</h3>
        <button type="button" onClick={props.onClose} className="text-sm text-slate-500">
          Close
        </button>
      </div>
      {phase === "request" ? (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <label className="block text-sm text-slate-600">
            Email
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-600">
            New password
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-50 disabled:opacity-50"
          >
            {loading ? "Sending code..." : "Send OTP"}
          </button>
          <button
            type="button"
            onClick={props.onBack}
            className="text-xs text-slate-500 underline"
          >
            Back to login
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <label className="block text-sm text-slate-600">
            OTP code
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="Enter 6-digit code"
            />
          </label>
          {testOtp && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Dev OTP: {testOtp}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-50 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify and reset password"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("request");
              setOtp("");
              setError(null);
            }}
            className="text-xs text-slate-500 underline"
          >
            Request new code
          </button>
        </form>
      )}
    </div>
  );
}

function SignupPanel() {
  const startSignupOtp = usePortalStore((state) => state.startSignupOtp);
  const verifySignupOtp = usePortalStore((state) => state.verifySignupOtp);
  const authError = usePortalStore((state) => state.authError);
  const authLoading = usePortalStore((state) => state.authLoading);
  const [fullName, setFullName] = useState("Aarav Patel");
  const [email, setEmail] = useState("aarav@example.com");
  const [country, setCountry] = useState("Canada");
  const [password, setPassword] = useState("ChangeMe123!");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"details" | "verify">("details");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (phase === "details") {
      const result = await startSignupOtp({ fullName, email, country, password });
      if (result) {
        setPhase("verify");
        setEmail(result.email);
        setTestOtp(result.testOtp ?? null);
        setNotice(`Verification code sent. It expires in ${result.expiresInMinutes} minutes.`);
      }
      return;
    }
    const verified = await verifySignupOtp({ email, otp });
    if (verified) {
      setNotice("Account verified. Redirecting to workspace...");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        cardShell,
        "space-y-4 p-8 lg:p-10 shadow-[0_40px_80px_rgba(15,23,42,0.12)]"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
        Client Registration
      </p>
      <h2 className="text-2xl font-semibold">Create your client account</h2>
      {phase === "details" ? (
        <>
          <label className="block text-sm text-slate-600">
            Full legal name
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-600">
            Email
            <input
              type="email"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-600">
            Password
            <input
              type={showPassword ? "text" : "password"}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="mt-1 text-xs text-slate-500 underline"
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </label>
          <label className="block text-sm text-slate-600">
            Country of residence
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block text-sm text-slate-600">
            Email
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900"
              value={email}
              readOnly
            />
          </label>
          <label className="block text-sm text-slate-600">
            Verification code
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
            />
          </label>
          {testOtp && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Dev OTP: {testOtp}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPhase("details");
              setOtp("");
              setNotice(null);
            }}
            className="text-xs text-slate-500 underline"
          >
            Edit signup details
          </button>
        </>
      )}
      {authError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {authError}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      )}
      <button
        type="submit"
        disabled={authLoading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-blue-50 transition hover:bg-black disabled:opacity-50"
      >
        {authLoading
          ? phase === "details"
            ? "Sending OTP..."
            : "Verifying OTP..."
          : phase === "details"
            ? "Create account"
            : "Verify and continue"}
        <Fingerprint className="h-4 w-4" />
      </button>
      <p className="text-xs text-slate-500">
        We vet clients and counsel and localize data inside India. Proceeding implies consent to those controls.
      </p>
    </form>
  );
}

function PortalWorkspace() {
  const caseId = usePortalStore((state) => state.caseId);
  const syncCases = usePortalStore((state) => state.syncCases);
  const stage = usePortalStore((state) => state.stage);
  const paymentStatus = usePortalStore((state) => state.paymentStatus);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const refreshCaseStatus = usePortalStore((state) => state.refreshCaseStatus);
  const caseStatus = usePortalStore((state) => state.caseStatus);
  const stageStatus = usePortalStore((state) => state.stageStatus);

  useEffect(() => {
    if (caseId) {
      void refreshCaseStatus();
    } else {
      void syncCases();
    }
  }, [caseId, refreshCaseStatus, syncCases]);

  useEffect(() => {
    console.log("[debug][portal] render PortalWorkspace", {
      caseId,
      stage,
      paymentStatus,
      platformFeePaid,
      caseStatus,
      stageStatus,
    });
  }, [caseId, stage, paymentStatus, platformFeePaid, caseStatus, stageStatus]);

  const renderByStatus = () => {
    switch (caseStatus) {
      case "SUBMITTED":
        return (
          <StatusCard
            title="Waiting for assignment"
            message="Your case is logged. A case manager will be assigned shortly."
            tone="info"
          />
        );
      case "UNDER_REVIEW":
        return (
          <StatusCard
            title="Under review"
            message="Operations is reviewing your brief. You'll receive a plan for approval."
            tone="info"
          />
        );
      case "AWAITING_CLIENT_APPROVAL":
        return <LegalPlanPanel />;
      case "PAYMENT_PENDING":
        return <PaymentSchedule />;
      case "IN_PROGRESS":
        return (
          <div className="space-y-8">
            <CaseTimeline />
            <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <DocumentVault />
              <VideoScheduler />
            </section>
          </div>
        );
      case "CLOSED":
        return <FinalSummary />;
      default:
        return (
          <StatusCard
            title="No active case"
            message="Start by submitting your details. Status will update automatically."
            tone="muted"
          />
        );
    }
  };

  return (
    <div className="space-y-8">
      <JourneySnapshot />
      {renderByStatus()}
    </div>
  );
}

function StatusCard({
  title,
  message,
  tone,
}: {
  title: string;
  message: string;
  tone: "info" | "muted";
}) {
  const toneClasses =
    tone === "info"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <section className={clsx(cardShell, "p-6 lg:p-8", toneClasses)}>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm">{message}</p>
    </section>
  );
}

function LegalPlanPanel() {
  const caseSummary = usePortalStore((state) => state.caseSummary);
  const paymentPlan = usePortalStore((state) => state.paymentPlan);
  const terms = usePortalStore((state) => state.terms);

  return (
    <section className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <h3 className="text-xl font-semibold">Review and approve plan</h3>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-line">
        {caseSummary || "Plan will appear once prepared by the case team."}
      </div>
      {paymentPlan && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 whitespace-pre-line">
          <p className="font-semibold text-slate-900">Payment plan</p>
          {paymentPlan}
        </div>
      )}
      {terms && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-line">
          <p className="font-semibold text-slate-900">Terms</p>
          {terms}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Approve the plan via your account manager. Status will move to payment pending once accepted.
      </p>
    </section>
  );
}

function FinalSummary() {
  const caseSummary = usePortalStore((state) => state.caseSummary);
  const timeline = usePortalStore((state) => state.timeline);
  return (
    <section className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <h3 className="text-xl font-semibold">Final summary</h3>
      <p className="text-sm text-slate-700">
        Engagement is closed. Download the highlights below for your records.
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-line">
        {caseSummary || "Summary unavailable."}
      </div>
      <div className="space-y-2">
        {timeline.slice(-5).map((event) => (
          <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold text-slate-900">{event.title}</p>
            <p className="text-slate-600">{event.description}</p>
            <p className="text-slate-500">{event.timestamp}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function JourneySnapshot() {
  const user = usePortalStore((state) => state.user);
  const stage = usePortalStore((state) => state.stage);
  const caseStatus = usePortalStore((state) => state.caseStatus);
  const selectedService = usePortalStore((state) => state.selectedService);

  const stageCopy: Record<string, string> = {
    login: "Login",
    "service-selection": "Select a service",
    "fee-payment": "Pay platform fee",
    "case-manager-assigned": "Case manager dispatched",
    "practitioner-assigned": "Practitioner assigned",
    "video-scheduled": "Consult locked",
    documents: "Documents",
    escrow: "Escrow",
  };

  return (
    <section className={clsx(cardShell, "p-6 lg:p-8")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Client</p>
          <p className="text-lg font-semibold text-slate-900">{user?.fullName}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <BadgeCheck className="h-4 w-4 text-emerald-500" />
          Current step
          <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-amber-50">
            {stageCopy[stage]}
          </span>
          {caseStatus && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-900">
              {caseStatus.replace(/_/g, " ")}
            </span>
          )}
          {selectedService && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
              {selectedService.label}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function ServiceCatalog() {
  const selectedService = usePortalStore((state) => state.selectedService);
  const selectService = usePortalStore((state) => state.selectService);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const paymentCaptured = usePortalStore((state) => state.paymentCaptured);
  const paymentStatus = usePortalStore((state) => state.paymentStatus);
  const paymentActionState = usePortalStore((state) => state.paymentActionState);
  const paymentActionMessage = usePortalStore((state) => state.paymentActionMessage);
  const caseId = usePortalStore((state) => state.caseId);
  const capturePlatformFee = usePortalStore((state) => state.capturePlatformFee);
  const [previewService, setPreviewService] = useState<ServiceId | null>(null);

  const paymentRequested = Boolean(caseId);
  const feeDisabled =
    !selectedService ||
    platformFeePaid ||
    paymentCaptured ||
    paymentActionState === "loading";
  const feeLabel =
    paymentActionState === "loading"
      ? "Launching secure checkout..."
      : platformFeePaid
        ? "Payment approved"
        : paymentCaptured
          ? "Awaiting admin approval"
          : paymentRequested
            ? "Retry $50 platform fee"
            : "Pay $50 platform fee";

  const heroService =
    legalServices.find(
      (service) => service.id === (previewService ?? selectedService?.id ?? legalServices[0].id)
    ) ?? legalServices[0];
  const Icon = serviceIconMap[heroService.id];

  return (
    <div className={clsx(cardShell, "space-y-6 p-6 lg:p-8")}> 
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Service Catalogue
          </p>
          <h3 className="text-2xl font-semibold">Select your legal mandate</h3>
        </div>
        <Lock className="h-5 w-5 text-slate-500" />
      </div>
      <ol className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
        {legalServices.map((service, index) => {
          const active = service.id === heroService.id;
          return (
            <li key={service.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => selectService(service.id)}
                onMouseEnter={() => setPreviewService(service.id)}
                onMouseLeave={() => setPreviewService(null)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-amber-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-900"
                )}
              >
                <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {service.label}
              </button>
              {index < legalServices.length - 1 && (
                <ChevronRight className="h-4 w-4 text-slate-300" />
              )}
            </li>
          );
        })}
      </ol>
      <div
        className="rounded-[24px] border px-6 py-6 lg:px-8"
        style={{
          borderColor: heroService.color,
          background: `linear-gradient(130deg, ${heroService.color}22, #ffffff)`
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="space-y-3 lg:w-2/3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
              <Icon className="h-4 w-4" /> {heroService.label}
            </span>
            <p className="text-lg text-slate-700">{heroService.summary}</p>
            <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {heroService.highlights.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 rounded-2xl bg-white/70 p-5 text-sm text-slate-600 lg:w-1/3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Compliance</p>
            <p className="font-semibold text-slate-900">{heroService.complianceNote}</p>
            <p className="text-xs text-slate-500">Service window: {heroService.turnaround}</p>
            <button
              disabled={feeDisabled}
              onClick={() => void capturePlatformFee()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-black disabled:opacity-30"
            >
              <HandCoins className="h-4 w-4" />
              {feeLabel}
            </button>
            {!selectedService && (
              <p className="text-xs text-slate-500">
                Select a mandate above to continue with the platform fee.
              </p>
            )}
            {paymentActionMessage && (
              <p
                className={clsx(
                  "text-xs",
                  paymentActionState === "error"
                    ? "text-rose-700"
                    : paymentActionState === "success"
                      ? "text-emerald-700"
                      : "text-slate-600"
                )}
              >
                {paymentActionMessage}
              </p>
            )}
            {paymentCaptured && !platformFeePaid && paymentStatus === "pending" && (
              <p className="text-xs text-amber-700">
                Admin approval is pending. You will be notified once payment is cleared.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <ShieldAlert className="mr-2 inline h-4 w-4" /> All billing remains within escrow and audited channels. Off-platform negotiation is prohibited.
      </div>
    </div>
  );
}

function RightColumn() {
  const assignedCaseManager = usePortalStore((state) => state.assignedCaseManager);
  const assignedPractitioner = usePortalStore((state) => state.assignedPractitioner);
  const paymentStatus = usePortalStore((state) => state.paymentStatus);
  const paymentCaptured = usePortalStore((state) => state.paymentCaptured);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const assurance = usePortalStore((state) => state.assurance);

  return (
    <div className="space-y-4">
      <div className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-slate-900" />
          <h3 className="text-lg font-semibold">Assignment desk</h3>
        </div>
        {!platformFeePaid && paymentCaptured && paymentStatus === "pending" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Payment approval in progress</p>
            <p className="text-slate-600">
              Your platform fee request is queued for compliance approval.
            </p>
          </div>
        ) : null}
        {assignedCaseManager ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Case manager: {assignedCaseManager.name}</p>
            <p className="text-slate-600">
              {assignedCaseManager.specialization} • {assignedCaseManager.timezone} • Load {" "}
              {assignedCaseManager.weeklyLoad}/week
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Once payment is approved, an NRI case manager will be allocated.
          </p>
        )}
        {assignedPractitioner ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{assignedPractitioner.name}</p>
            <p>{assignedPractitioner.bar}</p>
            <p>{assignedPractitioner.focus}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Practitioner assignment happens after manager review and escrow alignment.
          </p>
        )}
      </div>
      <div className={clsx(cardShell, "space-y-3 p-6 lg:p-8")}>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-900" />
          <h3 className="text-lg font-semibold">Compliance guardrails</h3>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          {assurance.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CaseIntake() {
  const caseDetails = usePortalStore((state) => state.caseDetails ?? "");
  const caseSummary = usePortalStore((state) => state.caseSummary);
  const setCaseDetailsDraft = usePortalStore((state) => state.setCaseDetailsDraft);
  const submitCaseDetails = usePortalStore((state) => state.submitCaseDetails);
  const paymentStatus = usePortalStore((state) => state.paymentStatus);
  const paymentCaptured = usePortalStore((state) => state.paymentCaptured);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const caseId = usePortalStore((state) => state.caseId);
  const [saving, setSaving] = useState(false);
  const paymentRequested = Boolean(caseId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    await submitCaseDetails(caseDetails);
    setSaving(false);
  };

  return (
    <section className={clsx(cardShell, "p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Case intake
          </p>
          <h3 className="text-2xl font-semibold">Share your case brief</h3>
        </div>
        <PenSquare className="h-5 w-5 text-slate-500" />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Provide a short summary of the matter, key dates, and current status. The desk uses
        this to prepare a case summary and align the correct assignments.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <textarea
          rows={5}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
          value={caseDetails}
          onChange={(event) => setCaseDetailsDraft(event.target.value)}
          placeholder="Example: Property dispute in Pune, hearing scheduled in December. Need escrow and title verification."
        />
        <button
          type="submit"
          disabled={saving || caseDetails.trim().length === 0}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save case brief"}
        </button>
      </form>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Payment status</p>
          <p>
            {platformFeePaid
              ? "Approved. Your case manager can activate assignments."
              : paymentCaptured && paymentStatus === "pending"
                ? "Pending approval. Compliance will confirm shortly."
                : paymentRequested
                  ? "Payment is not yet verified. Retry checkout to continue."
                : "Submit the platform fee once details are ready."}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold text-slate-900">Case summary</p>
          <p>{caseSummary ? caseSummary : "Summary will appear after intake review."}</p>
        </div>
      </div>
    </section>
  );
}

function CaseTimeline() {
  const timeline = usePortalStore((state) => state.timeline);

  if (!timeline.length) {
    return (
      <div className={clsx(cardShell, "p-6 text-sm text-slate-500")}>
        Select a mandate to generate the engagement timeline.
      </div>
    );
  }

  return (
    <div className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Case progression</h3>
        <MessageSquare className="h-5 w-5 text-slate-500" />
      </div>
      <ol className="space-y-4">
        {timeline.map((event) => (
          <li
            key={event.id}
            className={clsx(
              "rounded-2xl border border-neutral-200 px-4 py-3",
              event.status === "live" && "border-slate-900 bg-slate-50",
              event.status === "done" && "opacity-70"
            )}
          >
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-900">{event.title}</p>
              <span className="text-xs text-slate-500">{event.timestamp}</span>
            </div>
            <p className="text-sm text-slate-600">{event.description}</p>
            <p className="text-xs text-slate-500">Actor: {event.actor}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EscrowTracker() {
  const milestones = usePortalStore((state) => state.escrowMilestones);
  const advanceEscrow = usePortalStore((state) => state.advanceEscrow);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);

  const released = milestones
    .filter((milestone) => milestone.unlocked)
    .reduce((sum, milestone) => sum + milestone.amountPct, 0);

  return (
    <div className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Escrow governance</h3>
        <FolderLock className="h-5 w-5 text-slate-500" />
      </div>
      <p className="text-sm text-slate-600">
        60% drawdown when filings hit court, remaining 40% once the case is listed.
        The platform never allows fee bypass outside escrow.
      </p>
      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-amber-50">
        <p className="text-sm">Released</p>
        <p className="text-3xl font-semibold">{released}%</p>
      </div>
      <div className="space-y-3">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className={clsx(
              "rounded-2xl border border-neutral-200 p-4",
              milestone.unlocked && "border-emerald-200 bg-emerald-50"
            )}
          >
            <p className="font-semibold text-slate-900">{milestone.title}</p>
            <p className="text-sm text-slate-600">{milestone.description}</p>
            {milestone.amountPct > 0 && (
              <p className="text-xs text-slate-500">Unlocks {milestone.amountPct}%</p>
            )}
          </div>
        ))}
      </div>
      <button
        disabled={!platformFeePaid}
        onClick={() => void advanceEscrow()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900/20 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:opacity-40"
      >
        <CreditCardIcon /> Proceed with escrow workflow
      </button>
      {!platformFeePaid && (
        <p className="text-xs text-slate-500">Escrow actions unlock after payment approval.</p>
      )}
    </div>
  );
}

function CreditCardIcon() {
  return <CreditCard size={16} className="text-emerald-500" />;
}

function PaymentSchedule() {
  const bankInstructions = usePortalStore((state) => state.bankInstructions);
  const paymentPlan = usePortalStore((state) => state.paymentPlan);
  const terms = usePortalStore((state) => state.terms);
  const submitPaymentProof = usePortalStore((state) => state.submitPaymentProof);
  const paymentProofs = usePortalStore((state) => state.paymentProofs ?? []);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    await submitPaymentProof({ url: url || undefined, note: note || undefined });
    setSending(false);
    setUrl("");
    setNote("");
  };

  return (
    <section className={clsx(cardShell, "p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Payment schedule
          </p>
          <h3 className="text-2xl font-semibold">Bank transfer workflow</h3>
        </div>
        <CreditCard className="h-5 w-5 text-emerald-500" />
      </div>
      {bankInstructions ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Bank instructions</p>
          <p className="text-slate-700">{bankInstructions}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Awaiting payment instructions from case manager.</p>
      )}
      {paymentPlan && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-line">
          <p className="font-semibold text-slate-900">Schedule</p>
          {paymentPlan}
        </div>
      )}
      {terms && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-line">
          <p className="font-semibold text-slate-900">Terms & conditions</p>
          {terms}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm">
        <p className="font-semibold text-slate-900">Upload transaction proof</p>
        <input
          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Proof link (drive/share) or reference number"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Notes (bank, UTR, amount, date)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || (!url && !note)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-40"
        >
          {sending ? "Submitting..." : "Submit proof"}
        </button>
      </form>
      {paymentProofs.length > 0 && (
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Submitted proofs</p>
          {paymentProofs.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">
                {p.submittedBy} • {new Date(p.submittedAt).toLocaleString()}
              </p>
              {p.url && (
                <p className="text-sm text-blue-600">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>
                </p>
              )}
              {p.note && <p className="text-sm text-slate-700">{p.note}</p>}
              <p className="text-xs text-slate-500">{p.approved ? "Approved" : "Pending review"}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DocumentVault() {
  const documents = usePortalStore((state) => state.documents);
  const addDocument = usePortalStore((state) => state.addDocument);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const [name, setName] = useState("Court filing receipt");
  const [type, setType] = useState("Litigation");
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Document vault</h3>
        <FileText className="h-5 w-5 text-slate-500" />
      </div>
      <p className="text-sm text-slate-600">
        AES-256 encrypted storage. Practitioners view summaries unless explicit sharing is approved.
      </p>
      <div className="space-y-3">
        {documents.map((doc) => (
          <article
            key={doc.id}
            className="rounded-2xl border border-neutral-200 bg-white/90 p-4"
          >
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-900">{doc.name}</p>
              <span className="text-xs text-slate-500">
                {format(new Date(doc.updatedAt), "MMM dd, HH:mm")}
              </span>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {doc.type}
            </p>
            <p className="text-sm text-slate-600">{doc.summary}</p>
            <span
              className={clsx(
                "mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize",
                doc.status === "ready"
                  ? "bg-emerald-100 text-emerald-800"
                  : doc.status === "processing"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
              )}
            >
              {doc.status}
            </span>
          </article>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addDocument(name, type, fileName ?? undefined);
          setName("");
          setFileName(null);
        }}
        className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm"
      >
        <p className="font-semibold text-slate-900">Upload dossier</p>
        <input
          type="file"
          disabled={!platformFeePaid}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="w-full text-xs text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-amber-50 disabled:opacity-50"
        />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          disabled={!platformFeePaid}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
        />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          disabled={!platformFeePaid}
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Category"
        />
        <button
          disabled={!platformFeePaid}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-40"
        >
          <UploadIcon /> Add to Vault
        </button>
        {!platformFeePaid && (
          <p className="text-xs text-slate-500">
            Uploads unlock once the platform fee is approved.
          </p>
        )}
      </form>
      <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        <Camera className="mr-2 inline h-4 w-4 text-slate-900" /> Video witnessing and notarization trails are linked once vault entries are approved.
      </div>
    </div>
  );
}

function UploadIcon() {
  return <FileUp size={16} className="text-amber-600" />;
}

function VideoScheduler() {
  const videoCall = usePortalStore((state) => state.videoCall);
  const scheduleVideoCall = usePortalStore((state) => state.scheduleVideoCall);
  const platformFeePaid = usePortalStore((state) => state.platformFeePaid);
  const [slot, setSlot] = useState(() => new Date(Date.now() + 15 * 60 * 1000).toISOString());

  const slots = useMemo(
    () =>
      [15, 30, 45].map((minutes) =>
        new Date(Date.now() + minutes * 60 * 1000).toISOString()
      ),
    []
  );
  const joinLink = videoCall?.link ?? "/meeting/demo";

  const handleJoinNow = () => {
    if (typeof window !== "undefined") {
      window.open(joinLink, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={clsx(cardShell, "space-y-4 p-6 lg:p-8")}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Secure video consultation</h3>
        <Video className="h-5 w-5 text-slate-500" />
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900 text-amber-50">
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            <Wifi className="h-4 w-4" /> Amazon Chime Live
          </div>
          <div className="absolute bottom-4 left-4 flex gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-2 py-1">HD</span>
            <span className="rounded-full bg-white/10 px-2 py-1">REC</span>
          </div>
          <div className="absolute inset-0 grid grid-cols-2">
            <div className="flex items-end justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
              <div className="mb-6 text-center">
                <div className="mx-auto h-20 w-20 rounded-full border-2 border-white/40 bg-white/10" />
                <p className="mt-3 text-sm font-semibold">{videoCall ? "You" : "You"}</p>
                <p className="text-xs text-white/70">Client</p>
              </div>
            </div>
            <div className="flex items-end justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black">
              <div className="mb-6 text-center">
                <div className="mx-auto h-20 w-20 rounded-full border-2 border-white/40 bg-white/10" />
                <p className="mt-3 text-sm font-semibold">{videoCall?.provider ?? "Advocate"}</p>
                <p className="text-xs text-white/70">Practitioner</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {videoCall ? `Confirmed for ${videoCall.scheduledAt}` : "Amazon Chime room available"}
            </p>
            <p className="text-xs text-slate-500">
              HD sessions with recording and encrypted storage. Launching opens the meeting room.
            </p>
          </div>
          <button
            type="button"
            onClick={handleJoinNow}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-50"
          >
            <PhoneCall className="h-4 w-4" /> Launch Meeting Room
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {videoCall ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Confirmed slot</p>
          <p>{videoCall.scheduledAt}</p>
          <a href={videoCall.link} className="text-emerald-700 underline" target="_blank" rel="noreferrer">
            Join Meeting Room
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Suggested slots
            <select
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 disabled:opacity-50"
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              disabled={!platformFeePaid}
            >
              {slots.map((item) => (
                <option key={item} value={item}>
                  {format(new Date(item), "dd MMM yyyy, HH:mm")} UTC
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void scheduleVideoCall(slot)}
            disabled={!platformFeePaid}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900/20 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
          >
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
            Schedule Amazon Chime
          </button>
          {!platformFeePaid && (
            <p className="text-xs text-slate-500">
              Video scheduling unlocks after payment approval.
            </p>
          )}
        </div>
      )}
      <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        <Camera className="mr-2 inline h-4 w-4 text-slate-900" /> Video calls are recorded for compliance. Off-platform payment requests result in account suspension.
      </div>
    </div>
  );
}
