"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Bot,
  Eye,
  EyeOff,
  FolderKanban,
  GitBranch,
  Github,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthToast from "./AuthToast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const postAuthToastKey = "traceforge_post_auth_toast";
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Use 10-64 characters with uppercase, lowercase, number, and special character.";
const buildGoogleStartUrl = (mode: "login" | "signup", next: string) =>
  `${API_URL}/auth/google/start?mode=${encodeURIComponent(mode)}&next=${encodeURIComponent(next)}`;
const buildGithubStartUrl = (mode: "login" | "signup", next: string) =>
  `${API_URL}/auth/github/start?mode=${encodeURIComponent(mode)}&next=${encodeURIComponent(next)}`;

type AuthScreenProps = {
  mode: "login" | "signup";
};

const incidentStats = [
  { label: "Hits", value: "32" },
  { label: "Environment", value: "production" },
  { label: "Last seen", value: "2m ago" }
];

const reliabilityStats = [
  { label: "Projects", value: "8" },
  { label: "Alerts", value: "14" },
  { label: "Organizations", value: "3" }
];

export default function AuthScreen({ mode }: AuthScreenProps) {
  return (
    <Suspense fallback={<div className="tf-page pb-20 pt-16" />}>
      <AuthScreenInner mode={mode} />
    </Suspense>
  );
}

function AuthScreenInner({ mode }: AuthScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isReady, token } = useAuth();
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const next = searchParams.get("next") || "/dashboard";
  const oauthError = searchParams.get("oauthError") || "";
  const oauthEmail = searchParams.get("email") || "";
  const socialSignupToken = searchParams.get("socialSignupToken") || "";
  const socialProviderParam = searchParams.get("socialProvider") || "";
  const socialPrefillName = searchParams.get("fullName") || "";
  const socialProvider =
    socialProviderParam === "github"
      ? "GitHub"
      : socialProviderParam === "google"
      ? "Google"
      : "";
  const isSocialSignupContinuation = mode === "signup" && Boolean(socialSignupToken);

  const workflowItems =
    mode === "signup"
      ? [
          "Create the account and add your first project",
          "Send a test exception into the issue inbox",
          "Invite owners and configure your first alert rule"
        ]
      : [
          "Review the issue inbox with AI context",
          "Follow alert activity across your organization",
          "Check recent releases before triage begins"
        ];

  const featureCards =
    mode === "signup"
      ? [
          {
            icon: Bot,
            label: "AI issues",
            value: "Grouped with context",
            detail: "Summaries, stack traces, and regression clues stay connected."
          },
          {
            icon: BellRing,
            label: "Alerts",
            value: "Manual but team-aware",
            detail: "Route important signals to the right people without noisy defaults."
          },
          {
            icon: GitBranch,
            label: "Releases",
            value: "Deploy context included",
            detail: "See what changed before an issue started trending."
          },
          {
            icon: ShieldCheck,
            label: "Coverage",
            value: "Reliable by design",
            detail: "Projects, orgs, and alert ownership stay in one operational view."
          }
        ]
      : [
          {
            icon: Bot,
            label: "AI issues",
            value: "Real-time grouping",
            detail: "Incidents arrive grouped and summarized, ready for triage."
          },
          {
            icon: BellRing,
            label: "Alerts",
            value: "Live notification flow",
            detail: "Track the signals that matter without refreshing the page."
          },
          {
            icon: GitBranch,
            label: "Releases",
            value: "Correlated to incidents",
            detail: "Connect deploys to spikes before they become expensive."
          },
          {
            icon: ShieldCheck,
            label: "Coverage",
            value: "Reliable by design",
            detail: "Projects, orgs, and alert ownership stay in one operational view."
          }
        ];

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      router.replace(next);
    }
  }, [isReady, token, next, router]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!oauthError) {
      return;
    }

    const message =
      oauthError === "google_no_account"
        ? "No TraceForge account exists for this Google email yet. Please continue from sign up."
        : oauthError === "google_email_unverified"
        ? "Google did not return a verified email for this account."
        : oauthError === "google_not_configured"
        ? "Google sign-in is not configured yet."
        : oauthError === "github_no_account"
        ? "No TraceForge account exists for this GitHub email yet. Please continue from sign up."
        : oauthError === "github_not_configured"
        ? "GitHub sign-in is not configured yet."
        : oauthError === "github_auth_failed"
        ? "GitHub authentication failed. Please try again."
        : "Google authentication failed. Please try again.";

    setToast({ message, tone: "error" });
  }, [oauthError]);

  useEffect(() => {
    if (!isSocialSignupContinuation) {
      return;
    }

    if (oauthEmail) {
      setEmail(oauthEmail);
    }

    if (socialPrefillName) {
      setFullName((current) => current || socialPrefillName);
    }
  }, [isSocialSignupContinuation, oauthEmail, socialPrefillName]);

  const handleOauth = (provider: "Google" | "GitHub") => {
    setToast(null);

    if (provider === "Google") {
      window.location.href = buildGoogleStartUrl(mode, next);
      return;
    }

    window.location.href = buildGithubStartUrl(mode, next);
  };

  const handleSubmit = async () => {
    setToast(null);

    if (mode === "signup") {
      if (!fullName.trim() || !address.trim()) {
        setToast({ message: "Full name and address are required.", tone: "error" });
        return;
      }

      if (!agreedToTerms) {
        setToast({ message: "You must agree to the terms.", tone: "error" });
        return;
      }

      if (!isSocialSignupContinuation) {
        if (!passwordPolicy.test(password)) {
          setToast({ message: passwordPolicyMessage, tone: "error" });
          return;
        }

        if (!password || password !== confirmPassword) {
          setToast({ message: "Passwords do not match.", tone: "error" });
          return;
        }
      }
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "signup"
          ? isSocialSignupContinuation
            ? `${API_URL}/auth/oauth/complete-signup`
            : `${API_URL}/auth/register`
          : `${API_URL}/auth/login`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: mode === "signup" ? fullName : undefined,
          address: mode === "signup" ? address : undefined,
          signupToken: isSocialSignupContinuation ? socialSignupToken : undefined,
          email,
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.verificationRequired && data?.email) {
          router.push(
            `/verify?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(next)}`
          );
          return;
        }

        throw new Error(data.error || "Authentication failed");
      }

      if (mode === "signup" && data?.status === "verification_required" && data?.email) {
        router.push(
          `/verify?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(next)}&sent=1`
        );
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          postAuthToastKey,
          JSON.stringify({
              message:
                mode === "login"
                  ? "Signed in successfully."
                : isSocialSignupContinuation
                ? `${socialProvider || "Social"} account connected successfully.`
                : "Account created successfully.",
            tone: "success"
          })
        );
      }

      login(data.token, data.user);
      router.replace(data.next || next);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <main className="tf-page pb-20 pt-16">
        <div className="tf-container max-w-md">
          <div className="tf-card p-8">
            <div className="h-6 w-28 animate-pulse rounded-full bg-secondary/70" />
            <div className="mt-4 h-12 w-56 animate-pulse rounded-2xl bg-secondary/70" />
            <div className="mt-8 space-y-4">
              <div className="h-11 animate-pulse rounded-full bg-secondary/70" />
              <div className="h-11 animate-pulse rounded-full bg-secondary/70" />
              <div className="h-11 animate-pulse rounded-full bg-secondary/70" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`tf-page overflow-x-hidden pt-8 sm:pt-10 ${
        mode === "signup" ? "pb-8 lg:h-screen lg:overflow-hidden lg:pb-6 lg:pt-6" : "pb-12 sm:pb-14 lg:pb-16 lg:pt-12"
      }`}
    >
      <AuthToast toast={toast} />
      <div className="tf-container max-w-[96rem]">
        <div
          className={`grid gap-4 sm:gap-5 md:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.24fr)] ${
            mode === "signup" ? "lg:h-full" : ""
          }`}
        >
          <section className="tf-auth-panel order-2 hidden min-w-0 self-start rounded-[28px] border p-4 backdrop-blur md:block md:p-6 lg:order-1 lg:row-span-2 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Recent incident
            </p>
            <h2 className={`mt-4 max-w-[17ch] font-semibold text-text-primary [text-wrap:balance] text-[1.35rem] leading-[1.05] sm:text-[1.85rem] md:text-[2.35rem] ${mode === "signup" ? "lg:text-[2rem]" : "lg:text-[2.9rem]"}`}>
              Payment API timeout after release `api@2.8.0`
            </h2>
            <div className="mt-4">
              <span className="tf-danger-tag rounded-full border px-3 py-1 text-xs font-semibold">
                Critical
              </span>
            </div>

            <div className={`mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${mode === "signup" ? "lg:gap-3" : ""}`}>
              {incidentStats.map((item) => (
                <div
                  key={item.label}
                  className="tf-auth-inner-card min-w-0 rounded-2xl border px-4 py-3"
                >
                  <p
                    className={`font-semibold uppercase text-text-secondary break-normal ${
                      mode === "signup"
                        ? "text-[10px] leading-4 tracking-[0.08em]"
                        : "text-[11px] leading-4 tracking-[0.12em]"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-5 text-text-primary sm:text-base">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className={`tf-auth-inner-card mt-6 rounded-[24px] border p-4 sm:p-5 ${mode === "signup" ? "lg:mt-4 lg:p-4" : ""}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  AI summary
                </p>
              </div>
              <p className={`mt-3 max-w-[38ch] text-[13px] text-text-secondary sm:text-sm ${mode === "signup" ? "leading-5" : "leading-6"}`}>
                Likely tied to retry handling after the latest deploy, with production traffic exposing the failure path.
              </p>
            </div>

            {mode === "signup" && (
              <div className="mt-4 space-y-2.5">
                {[
                  "Project-ready setup",
                  "Invite-aware onboarding",
                  "Alert-first workflow"
                ].map((item) => (
                  <div
                    key={item}
                    className="tf-auth-inner-card flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-medium text-text-secondary"
                    title={item}
                  >
                    <Zap className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="whitespace-nowrap text-[13px] leading-5 sm:text-sm">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="order-3 hidden space-y-3 md:order-4 md:block md:space-y-4 lg:order-2 lg:space-y-6">
            <section className="tf-auth-soft-panel min-w-0 rounded-[24px] border p-4 backdrop-blur sm:p-5 md:p-6">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  Reliability snapshot
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reliabilityStats.map((item) => (
                  <div
                    key={item.label}
                    className="tf-auth-inner-card min-w-0 rounded-2xl border px-4 py-3"
                  >
                    <p
                      className={`font-semibold uppercase text-text-secondary break-normal ${
                        mode === "signup"
                          ? "text-[10px] leading-4 tracking-[0.08em]"
                          : "text-[11px] leading-4 tracking-[0.12em]"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-base font-semibold leading-5 text-text-primary sm:text-lg">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="tf-auth-soft-panel min-w-0 rounded-[24px] border p-4 backdrop-blur sm:p-5 md:p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  Workflow
                </p>
              </div>
              <div className="mt-4 space-y-2.5">
                {workflowItems.map((item) => (
                  <div
                    key={item}
                    className="tf-auth-inner-card min-w-0 rounded-2xl border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                      <p
                        className={`min-w-0 text-text-secondary ${
                          mode === "signup" ? "text-[13px] leading-5" : "text-sm leading-6"
                        }`}
                      >
                        {item}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="tf-auth-main-card order-1 w-full min-w-0 max-w-xl justify-self-center rounded-[28px] border p-4 backdrop-blur sm:p-5 md:order-3 md:max-w-none md:self-start md:p-6 lg:order-3 lg:row-span-2 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="tf-kicker">{mode === "login" ? "Login" : "Sign up"}</p>
              <span className="tf-auth-chip rounded-full border px-3 py-1 text-xs font-semibold text-text-secondary">
                {mode === "login" ? "Secure access" : "New account"}
              </span>
            </div>

            <h1 className={`mt-4 font-semibold leading-[1.02] text-text-primary text-[1.8rem] sm:text-[2.15rem] md:text-[2.65rem] ${
              mode === "signup"
                ? "max-w-[15ch] [text-wrap:pretty] lg:max-w-[16ch] lg:text-[2.4rem]"
                : "max-w-[12ch] [text-wrap:balance] lg:text-[3.35rem]"
            }`}>
              {mode === "login" ? "Welcome back to " : "Create your "}
              <Link
                href="/"
                className="decoration-primary underline underline-offset-[0.16em] transition hover:text-primary"
              >
                TraceForge
              </Link>
              {mode === "login" ? "" : " account"}
            </h1>
            <p className={`mt-3 max-w-[42ch] text-[13px] text-text-secondary sm:text-sm ${mode === "signup" ? "leading-5" : "leading-6"}`}>
              {mode === "login"
                ? "Sign in to review issues, manage alerts, and stay in sync with your organization workflows."
                : isSocialSignupContinuation
                ? `${socialProvider || "Your social provider"} verified your email. Add the remaining account details to finish creating your workspace.`
                : "Create your account to start capturing issues, routing alerts, and collaborating with your organization from one place."}
            </p>

            <div className="mt-6 space-y-3 sm:space-y-3.5">
              {isSocialSignupContinuation && (
                <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {socialProvider || "Social"} account connected
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{email}</p>
                </div>
              )}

              {mode === "signup" && (
                <div className="grid gap-2.5 lg:grid-cols-2">
                  <input
                    className="tf-input w-full bg-card/80"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                  <input
                    className="tf-input w-full bg-card/80"
                    placeholder="Address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
              )}

              <input
                className="tf-input w-full bg-card/80"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={isSocialSignupContinuation}
              />

              {mode === "signup" && !isSocialSignupContinuation ? (
                <>
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <div className="relative">
                      <input
                        className="tf-input w-full bg-card/80 pr-12"
                        placeholder="Create a password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        className="tf-input w-full bg-card/80 pr-12"
                        placeholder="Confirm password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-text-secondary">
                    Use 10-64 characters with uppercase, lowercase, number, and special character.
                  </p>
                  <label className="tf-auth-chip flex items-start gap-3 rounded-2xl border px-4 py-2.5 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(event) => setAgreedToTerms(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span>
                      I agree to the{" "}
                      <Link className="tf-link" href="/terms">
                        terms and conditions
                      </Link>
                      .
                    </span>
                  </label>
                </>
              ) : mode === "signup" ? (
                <label className="tf-auth-chip flex items-start gap-3 rounded-2xl border px-4 py-2.5 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    I agree to the{" "}
                    <Link className="tf-link" href="/terms">
                      terms and conditions
                    </Link>
                    .
                  </span>
                </label>
              ) : (
                <div className="relative">
                  <input
                    className="tf-input w-full bg-card/80 pr-12"
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}

              <button
                className="tf-button w-full px-4 py-3 text-sm"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? "Working..."
                  : mode === "login"
                  ? "Sign in"
                  : isSocialSignupContinuation
                  ? "Complete account"
                  : "Create account"}
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                {mode === "login" ? (
                  <Link className="tf-link" href="/forgot">
                    Forgot password?
                  </Link>
                ) : (
                  <span />
                )}
                {mode === "login" ? (
                  <Link className="tf-link" href={`/signup?next=${encodeURIComponent(next)}`}>
                    Need an account?
                  </Link>
                ) : (
                  <Link className="tf-link" href={`/signin?next=${encodeURIComponent(next)}`}>
                    Already have an account?
                  </Link>
                )}
              </div>

              {!isSocialSignupContinuation && (
                <div className="pt-1">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(226,232,240,0),rgba(226,232,240,1))]" />
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    {mode === "login" ? "Or sign in with" : "Or sign up with"}
                  </p>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(226,232,240,1),rgba(226,232,240,0))]" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="group inline-flex w-full items-center justify-center gap-2.5 rounded-[18px] border border-border/80 bg-card/88 px-3.5 py-3 text-[13px] font-semibold text-text-primary shadow-[0_8px_22px_hsl(var(--foreground)/0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-[0_14px_28px_hsl(var(--primary)/0.12)]"
                    onClick={() => handleOauth("Google")}
                    aria-label="Continue with Google"
                    title="Continue with Google"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          fill="#EA4335"
                          d="M12 10.2v3.95h5.49c-.24 1.27-.97 2.34-2.06 3.07l3.33 2.58c1.94-1.79 3.06-4.42 3.06-7.54 0-.73-.07-1.43-.19-2.08H12z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 21.9c2.77 0 5.1-.92 6.8-2.49l-3.33-2.58c-.92.62-2.1.99-3.47.99-2.67 0-4.94-1.8-5.75-4.23l-3.44 2.65c1.69 3.36 5.17 5.66 9.19 5.66z"
                        />
                        <path
                          fill="#4285F4"
                          d="M6.25 13.59c-.2-.62-.32-1.28-.32-1.97s.12-1.35.32-1.97L2.81 7c-.69 1.37-1.08 2.91-1.08 4.62s.39 3.25 1.08 4.62l3.44-2.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M12 5.43c1.5 0 2.84.52 3.89 1.53l2.91-2.91C17.09 2.45 14.77 1.35 12 1.35 7.98 1.35 4.5 3.65 2.81 7l3.44 2.65C7.06 7.23 9.33 5.43 12 5.43z"
                        />
                      </svg>
                    </span>
                    <span className="tracking-[0.01em]">Google</span>
                  </button>
                  <button
                    type="button"
                    className="group inline-flex w-full items-center justify-center gap-2.5 rounded-[18px] border border-border/80 bg-card/88 px-3.5 py-3 text-[13px] font-semibold text-text-primary shadow-[0_8px_22px_hsl(var(--foreground)/0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-[0_14px_28px_hsl(var(--foreground)/0.1)]"
                    onClick={() => handleOauth("GitHub")}
                    aria-label="Continue with GitHub"
                    title="Continue with GitHub"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2328] text-white shadow-[0_6px_14px_rgba(31,35,40,0.16)]">
                      <Github className="h-4 w-4" />
                    </span>
                    <span className="tracking-[0.01em]">GitHub</span>
                  </button>
                </div>
                </div>
              )}
            </div>
          </section>

          <section className="order-4 hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 lg:order-4 lg:col-span-3 lg:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`tf-auth-soft-panel min-w-0 rounded-[22px] border backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_52px_hsl(var(--primary)/0.16)] ${
                    mode === "signup" ? "p-3.5 sm:p-4" : "p-4 sm:p-5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-2xl border border-orange-100 bg-orange-50/90 text-orange-500 ${
                        mode === "signup" ? "p-1.5" : "p-2"
                      }`}
                    >
                      <Icon className={mode === "signup" ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    </div>
                    <p
                      className={`font-semibold uppercase text-text-secondary ${
                        mode === "signup"
                          ? "text-[10px] leading-4 tracking-[0.08em]"
                          : "text-[11px] leading-4 tracking-[0.12em]"
                      }`}
                    >
                      {card.label}
                    </p>
                  </div>
                  <p
                    className={`mt-4 font-semibold text-text-primary ${
                      mode === "signup" ? "text-[15px] leading-5" : "text-base leading-6"
                    }`}
                  >
                    {card.value}
                  </p>
                  {mode === "signup" ? (
                    <p className="mt-2 text-[11px] leading-4.5 text-text-secondary">
                      {card.detail}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {card.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}
