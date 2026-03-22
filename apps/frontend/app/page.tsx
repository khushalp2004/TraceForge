import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, createPageMetadata, SITE_NAME } from "./seo";

export const metadata: Metadata = createPageMetadata({
  title: SITE_NAME,
  description:
    "Turn stack traces into clear fixes with AI-powered error monitoring, issue grouping, and faster incident response for engineering teams.",
  path: "/",
  keywords: ["stack trace analysis", "incident response", "developer observability"]
});

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/traceforge.png")
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "AI-powered error monitoring for engineering teams, with issue grouping, release context, alerts, and remediation guidance.",
      url: absoluteUrl("/"),
      image: absoluteUrl("/traceforge.png")
    }
  ];

  return (
    <main className="tf-page pb-20 pt-14 sm:pb-24 sm:pt-16">
      {structuredData.map((item, index) => (
        <script
          key={`seo-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <div className="relative mx-auto max-w-6xl px-[16px]">
        <div
          className="pointer-events-none absolute -top-28 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-float-slow"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="pointer-events-none absolute top-24 left-6 h-56 w-56 rounded-full bg-primary/10 blur-3xl animate-pulse-slow"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="pointer-events-none absolute bottom-12 right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl animate-float-slow"
          style={{ animationDelay: "4s" }}
        />

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              AI-assisted error monitoring, minus the bloat
            </div>
            <h1 className="tf-title mt-6 text-3xl sm:text-4xl lg:text-6xl">
              Turn stack traces into clear fixes your team can ship.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-text-secondary">
              TraceForge captures errors, groups noisy stacks into one issue, and produces an AI
              remediation brief so you can go from incident to PR faster.
            </p>
            <div className="mt-7 space-y-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link className="tf-button w-full justify-center px-7 py-3 text-sm sm:w-auto" href="/signup">
                  Start trial
                </Link>
                <Link className="tf-button-ghost w-full justify-center px-7 py-3 text-sm sm:w-auto" href="/docs">
                  Quickstart guide
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-secondary">
                <span className="rounded-full border border-border bg-card px-2.5 py-1">No credit card</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1">SOC 2-ready</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1">5-min setup</span>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Grouping", value: "hash(message + stack)" },
                { label: "AI analysis", value: "new issues only" },
                { label: "Time to insight", value: "seconds" }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-card/90 px-4 py-4 shadow-sm"
                  style={{ animation: "fade-up 420ms ease both" }}
                >
                  <p className="text-xs font-semibold text-text-secondary">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="tf-glow-card p-1">
            <div className="rounded-[22px] border border-border bg-gradient-to-br from-card/95 to-secondary/70 p-4 sm:p-6 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-text-secondary">Live issue preview</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">Checkout · null pointer</p>
                </div>
                <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-text-secondary">
                  New
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-text-secondary">Fingerprint</p>
                    <span className="tf-pill">2 services</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] sm:text-[11px] text-text-secondary break-words">
                    9e7b… · hash("TypeError" + "at submitOrder…")
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                  <p className="text-xs font-semibold text-text-secondary">Stack (top frames)</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-ink px-3 py-2 text-[10px] sm:text-[11px] leading-5 text-white/90">
{`TypeError: Cannot read properties of undefined
  at submitOrder (checkout.ts:88:13)
  at onClick (Button.tsx:42:9)`}
                  </pre>
                </div>

                <div className="rounded-xl border border-primary/15 bg-accent-soft px-3 py-3 sm:px-4 text-xs text-text-primary break-words">
                  <span className="font-semibold">AI brief:</span> root cause introduced in checkout
                  refactor. Add a null guard for <span className="font-mono">customer.email</span>{" "}
                  before calling <span className="font-mono">sendReceipt()</span>.
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="tf-stat">
                  <p className="tf-stat-label">Frequency</p>
                  <p className="tf-stat-value">58</p>
                  <p className="tf-stat-hint">steady trend</p>
                </div>
                <div className="tf-stat">
                  <p className="tf-stat-label">Last seen</p>
                  <p className="tf-stat-value">2m ago</p>
                  <p className="tf-stat-hint">active incident</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-border bg-card/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 text-xs font-semibold text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span>Built for modern reliability teams</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border bg-card px-3 py-1">SOC 2-ready</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">Audit logs</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">SSO ready</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">Role-based access</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">Data retention controls</span>
            </div>
          </div>
        </section>

        <section className="mt-12 tf-marquee">
          <div className="tf-marquee-track">
            {[
              "GitHub Actions",
              "Vercel",
              "AWS Lambda",
              "Kubernetes",
              "Sentry Migration",
              "Slack Alerts",
              "PagerDuty",
              "Datadog Logs",
              "OpenTelemetry",
              "Node.js",
              "Python",
              "Go",
              "Postgres",
              "Redis",
              "Vite",
              "Next.js",
            ].map((item) => (
              <span key={`marquee-a-${item}`} className="tf-marquee-item">
                {item}
              </span>
            ))}
            {[
              "GitHub Actions",
              "Vercel",
              "AWS Lambda",
              "Kubernetes",
              "Sentry Migration",
              "Slack Alerts",
              "PagerDuty",
              "Datadog Logs",
              "OpenTelemetry",
              "Node.js",
              "Python",
              "Go",
              "Postgres",
              "Redis",
              "Vite",
              "Next.js",
            ].map((item) => (
              <span key={`marquee-b-${item}`} className="tf-marquee-item">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Instant signal",
              text: "Fingerprinting collapses noisy stacks into issues that stay stable across deploys."
            },
            {
              title: "Team workflows",
              text: "Invite teammates, approve access, and keep ownership clean across orgs and projects."
            },
            {
              title: "Release confidence",
              text: "Track frequency, last seen, and regressions with fast filters and a clean timeline."
            }
          ].map((feature) => (
            <div key={feature.title} className="tf-card p-6">
              <h3 className="tf-section-title">{feature.title}</h3>
              <p className="mt-3 text-sm text-text-secondary">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
          <div className="rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
            <p className="tf-kicker">Live Workflow</p>
            <h2 className="tf-title mt-4 text-2xl sm:text-3xl">
              See what broke, why it broke, and how to fix it in minutes.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary">
              TraceForge enriches stack traces with deploy context, ownership, and AI guidance so
              on-call engineers can ship a patch without context switching.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { title: "Ingest", text: "SDK captures errors with full trace context." },
                { title: "Group", text: "Hashing collapses noisy stacks into stable issues." },
                { title: "Diagnose", text: "AI brief highlights likely root causes." },
                { title: "Fix", text: "Suggested patch hints help you ship fast." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-primary">{item.title}</p>
                  <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
            <p className="tf-kicker">Outcome</p>
            <h3 className="tf-title mt-4 text-xl sm:text-2xl">Make incidents feel smaller.</h3>
            <div className="mt-6 space-y-4">
              {[
                { label: "Median triage", value: "6m", hint: "down from 28m" },
                { label: "Issue noise", value: "-62%", hint: "fewer duplicate tickets" },
                { label: "MTTR", value: "1.9h", hint: "with AI guidance" },
              ].map((stat) => (
                <div key={stat.label} className="tf-stat">
                  <p className="tf-stat-label">{stat.label}</p>
                  <p className="tf-stat-value">{stat.value}</p>
                  <p className="tf-stat-hint">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 tf-frame">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="tf-kicker">How it works</p>
              <h2 className="tf-title mt-4 text-2xl sm:text-3xl">From exception to fix in one workflow.</h2>
              <p className="mt-4 text-sm sm:text-base text-text-secondary">
                Capture errors from any service, enrich with context, and keep your team
                aligned on what matters most.
              </p>
              <Link className="tf-link mt-6 inline-flex" href="/docs">
                Explore the quickstart →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { step: "1", title: "Install SDK", text: "Drop in the client with a single API key." },
                {
                  step: "2",
                  title: "See grouped errors",
                  text: "Noise collapses into clean, actionable threads."
                },
                {
                  step: "3",
                  title: "Invite teammates",
                  text: "Owners review access and approve invites."
                },
                { step: "4", title: "Fix with AI", text: "Root-cause summaries guide the patch." }
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

        <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
            <p className="tf-kicker">Security</p>
            <h2 className="tf-title mt-4 text-2xl sm:text-3xl">Built for regulated environments.</h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary">
              TraceForge supports audit-ready workflows, role-based access, and secure
              data handling aligned with enterprise compliance requirements.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-text-secondary">
              <span className="tf-chip">SAML-ready</span>
              <span className="tf-chip">Audit logs</span>
              <span className="tf-chip">Data retention controls</span>
              <span className="tf-chip">Private projects</span>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
            <p className="tf-kicker">Reliability Outcomes</p>
            <h2 className="tf-title mt-4 text-2xl sm:text-3xl">Faster triage with fewer false alarms.</h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary">
              Consolidated issues, AI summaries, and context-rich traces reduce on-call toil and
              help teams ship fixes with less back-and-forth.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs font-semibold text-text-secondary">
              <div className="rounded-2xl border border-border bg-secondary/70 px-3 py-3">
                <p className="text-text-secondary">Alert noise</p>
                <p className="mt-2 text-lg font-semibold text-text-primary">-40%</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/70 px-3 py-3">
                <p className="text-text-secondary">Time to first fix</p>
                <p className="mt-2 text-lg font-semibold text-text-primary">-32%</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/70 px-3 py-3">
                <p className="text-text-secondary">Issue grouping</p>
                <p className="mt-2 text-lg font-semibold text-text-primary">2.6x</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-border bg-card/90 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-2xl sm:text-3xl">Ready to make errors boring?</h2>
              <p className="mt-2 text-sm sm:text-base text-text-secondary">
                Bring your team into TraceForge and ship with confidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="tf-button px-7 py-3 text-sm" href="/signup">
                Start free trial
              </Link>
              <Link className="tf-button-ghost px-7 py-3 text-sm" href="/docs">
                Talk to sales
              </Link>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-text-secondary">
            <span className="rounded-full border border-border bg-card px-2.5 py-1">14‑day trial</span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1">Cancel anytime</span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1">SOC 2-ready</span>
          </div>
        </section>
      </div>
    </main>
  );
}
