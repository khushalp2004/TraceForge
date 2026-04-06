import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Solutions",
  description:
    "See how TraceForge helps teams capture production issues, reduce noise, ship calmer releases, and resolve incidents faster.",
  path: "/solutions",
  keywords: ["error monitoring solutions", "incident response workflow", "release health observability"]
});

const operatingGroups = [
  {
    title: "Engineering leaders",
    description: "See reliability across teams, releases, and ownership boundaries without chasing status."
  },
  {
    title: "Platform teams",
    description: "Standardize capture, routing, and alerting across services with one predictable workflow."
  },
  {
    title: "Product teams",
    description: "Connect failures to customer impact so the next sprint fixes what users actually feel."
  }
];

const workflow = [
  {
    step: "01",
    title: "Capture real failures",
    description: "Collect backend, frontend, and worker errors with release and environment context."
  },
  {
    step: "02",
    title: "Collapse noise into issues",
    description: "Group repeating stacks into one issue so teams work the incident, not the duplicates."
  },
  {
    step: "03",
    title: "Generate the next step",
    description: "AI summaries and fix guidance help the owner start with context instead of guesswork."
  },
  {
    step: "04",
    title: "Coordinate the response",
    description: "Alerts, release health, projects, org workflows, and external integrations keep the right people aligned."
  }
];

const outcomes = [
  {
    title: "Issue grouping",
    detail: "Clean inboxes instead of duplicate stack traces"
  },
  {
    title: "AI remediation",
    detail: "Actionable summaries next to the error"
  },
  {
    title: "Release visibility",
    detail: "Know when a deploy changed error behavior"
  },
  {
    title: "Team ownership",
    detail: "Projects, orgs, and alerts stay accountable"
  },
  {
    title: "Repo intelligence",
    detail: "GitHub repo analysis adds architecture and onboarding context"
  }
];

const surfaces = [
  {
    title: "Issue inbox",
    points: ["Grouped errors", "Archive and restore", "Copy clean stack traces"]
  },
  {
    title: "AI solution",
    points: ["Short summary first", "Detail on demand", "Queue-aware generation state"]
  },
  {
    title: "Release health",
    points: ["Environment comparisons", "Alert correlation", "Change-focused investigation"]
  },
  {
    title: "Connected apps",
    points: ["Slack channels", "Jira projects", "GitHub issue creation"]
  }
];

export default function SolutionsPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <p className="tf-kicker">Solutions</p>
            <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
              TraceForge turns production errors into one calm workflow.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-text-secondary">
              We built TraceForge for teams that want fewer noisy dashboards and more
              clear next steps. Errors come in, duplicates collapse, AI explains what
              changed, the right team gets routed, and connected GitHub, Slack, and Jira
              workflows carry the response forward.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/signup">
                Start with TraceForge
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/product">
                Explore product
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Signal", value: "Grouped issues" },
                { label: "Speed", value: "AI summaries" },
                { label: "Coordination", value: "Projects + alerts" },
                { label: "Code context", value: "Repo analysis" }
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-card/90 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/95 p-5 shadow-sm sm:p-6">
            <div className="rounded-[1.5rem] border border-border bg-secondary/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Live workflow
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    From incident spike to a clear owner
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  {
                    title: "Checkout API timeout",
                    meta: "Grouped into 1 issue · 18 events in 6m",
                    state: "Investigating"
                  },
                  {
                    title: "AI summary ready",
                    meta: "Likely triggered after release web@2.4.1",
                    state: "Actionable"
                  },
                  {
                    title: "Alert routed to payments team",
                    meta: "Owner and org context attached",
                    state: "Assigned"
                  },
                  {
                    title: "GitHub repo report ready",
                    meta: "Architecture, entry points, and key modules summarized",
                    state: "Prepared"
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-card px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                      <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-text-secondary">
                        {item.state}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {operatingGroups.map((item) => (
            <div key={item.title} className="tf-card p-6">
              <h2 className="tf-section-title">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="tf-kicker">What TraceForge does</p>
              <h2 className="tf-title mt-4 text-3xl">It mirrors the way real incidents unfold.</h2>
              <p className="mt-3 max-w-2xl text-sm text-text-secondary">
                Capture is only the start. The product gets better when it helps teams
                decide what matters, who owns it, what changed, and where the fix likely
                lives in the codebase.
              </p>
            </div>
            <Link className="tf-link inline-flex text-sm" href="/pricing">
              See plans →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((item) => (
                <div key={item.step} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Step {item.step}
                </p>
                <h3 className="mt-3 text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm">
            <p className="tf-kicker">Product surfaces</p>
            <h2 className="tf-title mt-4 text-3xl">Built around the views teams actually open.</h2>
            <div className="mt-6 space-y-4">
              {surfaces.map((surface) => (
                <div key={surface.title} className="rounded-2xl border border-border bg-secondary/60 p-5">
                  <p className="text-base font-semibold text-text-primary">{surface.title}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {surface.points.map((point) => (
                      <div key={point} className="rounded-xl border border-border bg-card px-3 py-3 text-xs font-medium text-text-secondary">
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm">
            <p className="tf-kicker">Outcomes</p>
            <h2 className="tf-title mt-4 text-3xl">Designed to make shipping feel safer.</h2>
            <div className="mt-6 space-y-3">
              {outcomes.map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border bg-secondary/60 px-4 py-4">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-primary/15 bg-accent-soft p-4">
              <p className="text-sm font-semibold text-text-primary">Success looks like this</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                A team opens TraceForge after a release, sees one grouped issue instead
                of sixty duplicate events, reads the AI summary, routes the alert, and
                fixes the regression before customers start filing tickets.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
