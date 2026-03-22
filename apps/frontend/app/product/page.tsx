import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Product",
  description:
    "Explore TraceForge features for AI-assisted error monitoring, issue grouping, alerts, release health, and team workflows.",
  path: "/product",
  keywords: ["error tracking features", "release health", "AI issue triage"]
});

export default function ProductPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="tf-kicker">Product</p>
            <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
              TraceForge keeps production quiet with AI error intelligence.
            </h1>
            <p className="mt-6 text-lg text-text-secondary">
              Capture exceptions across services, group noisy stacks into clean issues, and
              route them to the right teams with enterprise-grade workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/signup">
                Start trial
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                View Docs
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Time to insight", value: "seconds" },
                { label: "Issue grouping", value: "2.6x" },
                { label: "Noise reduced", value: "-40%" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-card/90 px-4 py-3">
                  <p className="text-xs font-semibold text-text-secondary">{stat.label}</p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-lg">
            <div className="rounded-2xl border border-border bg-secondary/70 p-6">
              <p className="text-xs font-semibold text-text-secondary">Unified Error View</p>
              <div className="mt-4 space-y-3">
                {[
                  "API: timeout spike after deploy",
                  "Frontend: null pointer on checkout",
                  "Worker: queue backlog exceeded"
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary">{item}</p>
                    <p className="mt-1 text-xs text-text-secondary">Last seen 3m ago</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-primary/15 bg-accent-soft px-4 py-3 text-xs text-text-primary">
                AI summary: Likely caused by missing retry guard in `chargeCustomer`.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Signal over noise",
              text: "Automatic grouping, fingerprinting, and dedupe for clean issue lists."
            },
            {
              title: "Team workflows",
              text: "Invite teams, set roles, and route incidents by org and project."
            },
            {
              title: "AI remediation",
              text: "Root-cause analysis and suggested fixes surfaced where you work."
            }
          ].map((feature) => (
            <div key={feature.title} className="tf-card p-6">
              <h3 className="tf-section-title">{feature.title}</h3>
              <p className="mt-3 text-sm text-text-secondary">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Frontend reliability",
              text: "Client-side exceptions, source maps, and replay context for fast debugging."
            },
            {
              title: "Backend safeguards",
              text: "API and worker errors grouped with release and environment visibility."
            },
            {
              title: "Observability handoff",
              text: "Tag incidents and forward to Slack, PagerDuty, or Jira when needed."
            }
          ].map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold text-primary">{feature.title}</p>
              <p className="mt-3 text-sm text-text-secondary">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="tf-kicker">Workflow</p>
              <h2 className="tf-title mt-4 text-3xl">From error to resolution in minutes.</h2>
              <p className="mt-4 text-sm text-text-secondary">
                TraceForge connects error telemetry with ownership, so teams move fast
                without losing accountability.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { step: "1", title: "Capture", text: "Errors land with full context." },
                { step: "2", title: "Group", text: "Noise collapses into issues." },
                { step: "3", title: "Route", text: "Owners approve access." },
                { step: "4", title: "Resolve", text: "AI briefs guide the fix." }
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-primary">Step {item.step}</p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-2 text-xs text-text-secondary">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="tf-kicker">Launch</p>
              <h2 className="tf-title mt-4 text-2xl sm:text-3xl">Start shipping calmer releases.</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Get TraceForge running in minutes with a single API key.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="tf-button px-6 py-3 text-sm" href="/signup">
                Start trial
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                Read docs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
