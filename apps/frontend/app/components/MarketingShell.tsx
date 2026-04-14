"use client";

import { Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AuthToast from "./AuthToast";
import SiteHeader from "./SiteHeader";

const marketingRoots = [
  "/",
  "/product",
  "/pricing",
  "/solutions",
  "/docs",
  "/about",
  "/blog",
  "/terms",
  "/privacy",
  "/security",
  "/help",
  "/contact"
];

const isMarketingRoute = (pathname: string) => {
  if (pathname === "/") return true;
  return marketingRoots.some((root) => root !== "/" && pathname.startsWith(root));
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function MarketingShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const showMarketing = isMarketingRoute(pathname);
  const year = new Date().getFullYear();
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() || "https://www.linkedin.com/company/traceforge";
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscribeState, setSubscribeState] = useState<"idle" | "loading">("idle");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const normalizedPath = useMemo(() => pathname || "/", [pathname]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = subscriberEmail.trim().toLowerCase();

    if (!email) {
      setToast({ message: "Enter your email to get TraceForge updates.", tone: "error" });
      return;
    }

    setSubscribeState("loading");
    setToast(null);

    try {
      const response = await fetch(`${API_URL}/marketing/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          sourcePath: normalizedPath
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to subscribe right now");
      }

      setSubscriberEmail("");
      setToast({
        message: "You’re on the list. We’ll send product updates and launch offers here.",
        tone: "success"
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Unable to subscribe right now",
        tone: "error"
      });
    } finally {
      setSubscribeState("idle");
    }
  };

  return (
    <>
      {showMarketing ? <SiteHeader /> : null}
      {children}
      <AuthToast toast={toast} />
      {showMarketing ? (
        <footer className="border-t border-border bg-card/95">
          <div className="tf-container px-[24px] py-12 sm:px-[30px] sm:py-14">
            <div className="rounded-[2rem] border border-primary/10 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(168,85,247,0.08),rgba(15,23,42,0.02))] p-6 shadow-sm sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                    Stay in the loop
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                    Get TraceForge updates, launch offers, and practical release workflow tips.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
                    We’ll send short product notes when new monitoring, AI, and incident workflow
                    improvements land — plus the occasional early-access offer.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
                    <span className="rounded-full border border-border bg-background/70 px-3 py-1">
                      Product updates
                    </span>
                    <span className="rounded-full border border-border bg-background/70 px-3 py-1">
                      Launch offers
                    </span>
                    <span className="rounded-full border border-border bg-background/70 px-3 py-1">
                      No spam
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link className="tf-button-ghost justify-center px-5 py-3 text-sm" href="/docs">
                      Read quickstart
                    </Link>
                    <Link className="tf-button-ghost justify-center px-5 py-3 text-sm" href="/pricing">
                      Compare plans
                    </Link>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-primary/10 bg-background/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">Subscribe for email updates</p>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        Use your work email and we’ll keep you posted on app updates, product notes, and launch offers.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-[1.25rem] border border-border bg-card/80 p-3 text-xs text-text-secondary sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Fresh product updates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Special offers when we launch them</span>
                    </div>
                  </div>
                  <form className="mt-4 space-y-3" onSubmit={handleSubscribe}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <label className="sr-only" htmlFor="footer-subscribe-email">
                        Email address
                      </label>
                      <input
                        id="footer-subscribe-email"
                        type="email"
                        value={subscriberEmail}
                        onChange={(event) => {
                          setSubscriberEmail(event.target.value);
                          if (toast) {
                            setToast(null);
                          }
                        }}
                        placeholder="Enter your work email"
                        autoComplete="email"
                        className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        aria-label="Email address"
                      />
                      <button
                        type="submit"
                        className="tf-button justify-center rounded-2xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[150px]"
                        disabled={subscribeState === "loading"}
                      >
                        {subscribeState === "loading" ? "Subscribing..." : "Subscribe"}
                      </button>
                    </div>
                    <p className="text-xs leading-5 text-text-secondary">
                      Monthly notes only. No spam. You can unsubscribe anytime.
                    </p>
                  </form>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr]">
              <div className="max-w-sm">
                <Link href="/" className="text-lg font-semibold tracking-tight text-text-primary transition hover:text-primary">
                  TraceForge
                </Link>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Error monitoring that groups noise, explains likely causes, routes alerts, and
                  carries incident context into GitHub, Slack, and Jira.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
                  <span className="rounded-full border border-border bg-card px-3 py-1">Grouped issues</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1">Repo analysis</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1">Slack + Jira</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-text-primary">Product</p>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <Link className="block transition hover:text-text-primary" href="/product">
                    Product
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/solutions">
                    Solutions
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/pricing">
                    Pricing
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/docs">
                    Docs
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-text-primary">Company</p>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <Link className="block transition hover:text-text-primary" href="/about">
                    About
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/blog">
                    Blog
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/signin">
                    Sign in
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/signup">
                    Create account
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-text-primary">Trust & support</p>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <Link className="block transition hover:text-text-primary" href="/terms">
                    Terms
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/privacy">
                    Privacy
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/security">
                    Security & compliance
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/help">
                    Help
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/contact">
                    Contact us
                  </Link>
                  <a
                    className="block transition hover:text-text-primary"
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-text-primary">Start here</p>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <Link className="block transition hover:text-text-primary" href="/docs">
                    Quickstart
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/pricing">
                    Compare plans
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/solutions">
                    See workflows
                  </Link>
                  <Link className="block transition hover:text-text-primary" href="/blog/repo-analysis-for-faster-onboarding">
                    Repo analysis
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
              <p>© {year} TraceForge. Built for teams that want calmer production workflows.</p>
              <div className="flex flex-wrap items-center gap-4">
                <Link className="transition hover:text-text-primary" href="/docs">
                  Documentation
                </Link>
                <Link className="transition hover:text-text-primary" href="/privacy">
                  Privacy
                </Link>
                <Link className="transition hover:text-text-primary" href="/terms">
                  Terms
                </Link>
                <Link className="transition hover:text-text-primary" href="/pricing">
                  Plans
                </Link>
                <Link className="transition hover:text-text-primary" href="/signup">
                  Start free
                </Link>
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </>
  );
}
