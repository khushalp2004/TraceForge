"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export default function MarketingShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const showMarketing = isMarketingRoute(pathname);
  const year = new Date().getFullYear();
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() || "https://www.linkedin.com/company/traceforge";

  return (
    <>
      {showMarketing ? <SiteHeader /> : null}
      {children}
      {showMarketing ? (
        <footer className="border-t border-border bg-card/95">
          <div className="tf-container px-[24px] py-12 sm:px-[30px] sm:py-14">
            <div className="rounded-[2rem] border border-border bg-secondary/35 p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Built for calmer releases
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                    Use one workflow for grouped issues, AI summaries, alerts, and GitHub follow-up.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
                    TraceForge helps teams move from a production error to the right owner, the right
                    code context, and the next action without rebuilding the same context in five tools.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link className="tf-button justify-center px-6 py-3 text-sm" href="/signup">
                    Start free
                  </Link>
                  <Link className="tf-button-ghost justify-center px-6 py-3 text-sm" href="/docs">
                    Read quickstart
                  </Link>
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
