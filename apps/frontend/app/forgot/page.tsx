"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  "Recover access without leaving your monitoring workflow",
  "Reset the password and return to the issue inbox quickly",
  "Keep alerts, releases, and organization access in sync"
];

const featureCards = [
  {
    icon: Bot,
    label: "AI issues",
    value: "Triage stays connected",
    detail: "Recovery flows bring you back to grouped issues with context intact."
  },
  {
    icon: BellRing,
    label: "Alerts",
    value: "Signals stay live",
    detail: "Ownership and alert visibility continue once access is restored."
  },
  {
    icon: GitBranch,
    label: "Releases",
    value: "Deploy context preserved",
    detail: "Release history remains tied to incidents after re-entry."
  },
  {
    icon: ShieldCheck,
    label: "Coverage",
    value: "Secure by default",
    detail: "Password recovery stays inside the same trusted workspace flow."
  }
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubmit = async () => {
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      setToast({
        message:
          "If the email exists, a reset link was sent. Check your inbox",
        tone: "success"
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  };

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
                      <p className="min-w-0 text-sm leading-6 text-text-secondary">
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
              <p className="tf-kicker">Password reset</p>
              <span className="tf-auth-chip rounded-full border px-3 py-1 text-xs font-semibold text-text-secondary">
                Recovery
              </span>
            </div>

            <h1 className="mt-4 max-w-[13ch] text-[1.8rem] font-semibold leading-[1.02] text-text-primary [text-wrap:balance] sm:text-[2.15rem] md:text-[2.65rem] lg:text-[3.1rem]">
              Reset your{" "}
              <Link
                href="/"
                className="decoration-primary underline underline-offset-[0.16em] transition hover:text-primary"
              >
                TraceForge
              </Link>{" "}
              password
            </h1>
            <p className="mt-3 max-w-[42ch] text-[13px] leading-6 text-text-secondary sm:text-sm">
              Enter your account email and we&apos;ll start the recovery flow so you can get back to issues, alerts, and releases quickly.
            </p>

            <div className="mt-6 space-y-3.5">
              <input
                className="tf-input w-full bg-card/80"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <button
                className="tf-button w-full px-4 py-3 text-sm"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                <Link className="tf-link" href="/signin">
                  Back to login
                </Link>
                <Link className="tf-link" href="/signup">
                  Need an account?
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
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/90 p-2 text-orange-500">
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
