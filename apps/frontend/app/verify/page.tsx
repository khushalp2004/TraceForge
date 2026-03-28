"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Bot,
  FolderKanban,
  GitBranch,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import AuthToast from "../components/AuthToast";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const postAuthToastKey = "traceforge_post_auth_toast";

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

const workflowItems = [
  "Check your inbox for the six-digit verification code",
  "Confirm the code to unlock your workspace session",
  "Return to issues, alerts, and releases in one step"
];

const featureCards = [
  {
    icon: Bot,
    label: "AI issues",
    value: "Context waits for you",
    detail: "Verification is a short step before the issue inbox and summaries open up."
  },
  {
    icon: BellRing,
    label: "Alerts",
    value: "Team access protected",
    detail: "Owners and members only get in-app signals after confirming their email."
  },
  {
    icon: GitBranch,
    label: "Releases",
    value: "Deploy context intact",
    detail: "Your release and incident history is ready once the account is verified."
  },
  {
    icon: ShieldCheck,
    label: "Coverage",
    value: "Secure by default",
    detail: "Email confirmation keeps organization access and account recovery safer."
  }
];

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="tf-page pb-20 pt-16" />}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, isReady, token } = useAuth();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const next = searchParams.get("next") || "/dashboard";
  const sent = searchParams.get("sent") === "1";

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      router.replace(next);
    }
  }, [isReady, token, next, router]);

  useEffect(() => {
    if (!sent) return;
    setToast({
      message: `Verification code sent to ${initialEmail || "your email address"}.`,
      tone: "success"
    });
  }, [sent, initialEmail]);

  const maskedEmail = useMemo(() => {
    const trimmed = email.trim();
    const [localPart, domain] = trimmed.split("@");
    if (!localPart || !domain) return trimmed;
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.length > 4 ? localPart.slice(-1) : "";
    return `${visibleStart}${"*".repeat(Math.max(localPart.length - 3, 1))}${visibleEnd}@${domain}`;
  }, [email]);

  const otpSlots = useMemo(() => Array.from({ length: 6 }, (_, index) => code[index] ?? ""), [code]);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) {
      setToast({ message: "Email and verification code are required.", tone: "error" });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          postAuthToastKey,
          JSON.stringify({
            message: "Email verified successfully.",
            tone: "success"
          })
        );
      }

      login(data.token, data.user);
      router.replace(next);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setToast({ message: "Enter your email before requesting a new code.", tone: "error" });
      return;
    }

    setResending(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not resend verification code");
      }

      setToast({
        message: `A new verification code was sent to ${email.trim()}.`,
        tone: "success"
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setResending(false);
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
    <main className="tf-page overflow-x-hidden pb-12 pt-8 sm:pb-14 sm:pt-10 lg:pb-16 lg:pt-12">
      <AuthToast toast={toast} />
      <div className="tf-container max-w-[96rem]">
        <div className="grid gap-4 sm:gap-5 md:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.24fr)]">
          <section className="tf-auth-panel order-2 hidden min-w-0 self-start rounded-[28px] border p-4 backdrop-blur md:block md:p-6 lg:order-1 lg:row-span-2 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Recent incident
            </p>
            <h2 className="mt-4 max-w-[17ch] text-[1.35rem] font-semibold leading-[1.05] text-text-primary [text-wrap:balance] sm:text-[1.85rem] md:text-[2.35rem] lg:text-[2.9rem]">
              Payment API timeout after release `api@2.8.0`
            </h2>
            <div className="mt-4">
              <span className="tf-danger-tag rounded-full border px-3 py-1 text-xs font-semibold">
                Critical
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {incidentStats.map((item) => (
                <div
                  key={item.label}
                  className="tf-auth-inner-card min-w-0 rounded-2xl border px-4 py-3"
                >
                  <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-text-secondary">
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-5 text-text-primary sm:text-base">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="tf-auth-inner-card mt-6 rounded-[24px] border p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  AI summary
                </p>
              </div>
              <p className="mt-3 max-w-[38ch] text-[13px] leading-6 text-text-secondary sm:text-sm">
                Likely tied to retry handling after the latest deploy, with production traffic exposing the failure path.
              </p>
            </div>
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
                    <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-text-secondary">
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
                  Verification flow
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
                      <p className="min-w-0 text-sm leading-6 text-text-secondary">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="tf-auth-main-card order-1 w-full min-w-0 max-w-xl justify-self-center rounded-[28px] border p-4 backdrop-blur sm:p-5 md:order-3 md:max-w-none md:self-start md:p-6 lg:order-3 lg:row-span-2 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="tf-kicker">Email verification</p>
              <span className="tf-auth-chip rounded-full border px-3 py-1 text-xs font-semibold text-text-secondary">
                OTP required
              </span>
            </div>

            <h1 className="mt-4 max-w-[14ch] text-[1.8rem] font-semibold leading-[1.02] text-text-primary [text-wrap:balance] sm:text-[2.15rem] md:text-[2.65rem] lg:text-[3.1rem]">
              Verify your{" "}
              <Link
                href="/"
                className="decoration-primary underline underline-offset-[0.16em] transition hover:text-primary"
              >
                TraceForge
              </Link>{" "}
              email
            </h1>
            <p className="mt-3 max-w-[42ch] text-[13px] leading-6 text-text-secondary sm:text-sm">
              Enter the six-digit code sent to {maskedEmail || "your email address"} to activate the account and continue into your workspace.
            </p>

            <div className="mt-6 space-y-5">
              <div className="space-y-2.5">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Email address
                </label>
                <input
                  className="tf-input w-full bg-card/80"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Verification code
                  </label>
                  <span className="text-xs text-text-secondary">Expires in 10 min</span>
                </div>

                <div
                  className="tf-otp-shell relative cursor-text rounded-[28px] border p-3"
                  onClick={() => codeInputRef.current?.focus()}
                >
                  <input
                    ref={codeInputRef}
                    className="absolute inset-0 z-10 opacity-0"
                    placeholder="000000"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Verification code"
                  />
                  <div className="grid grid-cols-6 gap-2.5 sm:gap-3">
                    {otpSlots.map((digit, index) => {
                      const isActive = index === Math.min(code.length, 5);
                      const isFilled = Boolean(digit);

                      return (
                        <div
                          key={`otp-slot-${index}`}
                          className={`flex h-14 items-center justify-center rounded-[18px] border text-lg font-semibold transition sm:h-16 sm:text-[1.15rem] ${
                            isFilled
                              ? "tf-otp-slot-filled"
                              : isActive
                                ? "tf-otp-slot-active"
                                : "tf-otp-slot"
                          }`}
                        >
                          {digit || ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs leading-5 text-text-secondary">
                  Enter the 6-digit code sent to {maskedEmail || "your email address"}.
                </p>
              </div>

              <button
                className="tf-button w-full px-4 py-3 text-sm"
                onClick={handleVerify}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  className="tf-link text-left"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? "Sending..." : "Resend code"}
                </button>
                <Link className="tf-link" href="/signin">
                  Back to login
                </Link>
              </div>
            </div>
          </section>

          <section className="order-4 hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 lg:col-span-3 lg:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="tf-auth-soft-panel min-w-0 rounded-[22px] border p-4 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_52px_hsl(var(--primary)/0.16)] sm:p-5"
                >
                  <div className="flex items-center gap-2">
                    <div className="tf-auth-accent-icon rounded-2xl border p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-text-secondary">
                      {card.label}
                    </p>
                  </div>
                  <p className="mt-4 text-base font-semibold leading-6 text-text-primary">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {card.detail}
                  </p>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}
