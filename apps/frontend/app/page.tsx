import Link from "next/link";

export default function HomePage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="relative mx-auto max-w-6xl">
        <div className="pointer-events-none absolute -top-24 right-6 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute top-24 left-6 h-44 w-44 rounded-full bg-slate-200/70 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-32 h-52 w-52 rounded-full bg-indigo-200/40 blur-3xl" />

        <section className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Trusted by platform teams running 24/7 systems
            </div>
            <h1 className="tf-title mt-5 text-4xl sm:text-5xl lg:text-6xl">
              Enterprise-grade error intelligence that keeps production calm.
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              TraceForge captures errors across services, clusters noisy stacks, and
              delivers AI-ready remediation briefs so teams resolve incidents before
              customers notice.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/dashboard">
                Open Dashboard
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                Read Docs
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "120k+", value: "Issues resolved" },
                { label: "4 min", value: "Median triage time" },
                { label: "99.99%", value: "Ingestion uptime" }
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Incident Command</p>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                  Live
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  {
                    title: "Payments · webhook retries spike",
                    meta: "Prod · 143 hits · 2m ago",
                    severity: "P1"
                  },
                  {
                    title: "Checkout · null pointer in signup flow",
                    meta: "Staging · 58 hits · 6m ago",
                    severity: "P2"
                  },
                  {
                    title: "API · cache miss storm after deploy",
                    meta: "Prod · 81 hits · 12m ago",
                    severity: "P1"
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <span className="tf-badge">{item.severity}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                AI brief: Root cause introduced in checkout refactor. Suggested fix:
                restore null guard on `customer.email`.
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Affected users</p>
                  <p className="mt-1 text-lg font-semibold text-ink">1,284</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Est. revenue risk</p>
                  <p className="mt-1 text-lg font-semibold text-ink">$18.4k</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-500">
            <span>Trusted by reliability teams at</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">AtlasBank</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Northwind</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Helios</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Greylock</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Rivermind</span>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Instant signal",
              text: "AI grouping collapses noisy stacks into the issues that matter."
            },
            {
              title: "Ownership workflows",
              text: "Invite teams, enforce permissions, and approve access with confidence."
            },
            {
              title: "Release confidence",
              text: "Track error frequency, environment health, and regression risk."
            }
          ].map((feature) => (
            <div key={feature.title} className="tf-card p-6">
              <h3 className="tf-section-title">{feature.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="tf-kicker">How it works</p>
              <h2 className="tf-title mt-4 text-3xl">From exception to fix in one workflow.</h2>
              <p className="mt-4 text-sm text-slate-600">
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
                <div key={item.step} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-blue-700">Step {item.step}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
            <p className="tf-kicker">Security</p>
            <h2 className="tf-title mt-4 text-3xl">Built for regulated environments.</h2>
            <p className="mt-3 text-sm text-slate-600">
              TraceForge supports audit-ready workflows, role-based access, and secure
              data handling aligned with enterprise compliance requirements.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="tf-chip">SAML-ready</span>
              <span className="tf-chip">Audit logs</span>
              <span className="tf-chip">Data retention controls</span>
              <span className="tf-chip">Private projects</span>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
            <p className="tf-kicker">Customer Story</p>
            <h2 className="tf-title mt-4 text-3xl">“We cut triage time by 64%.”</h2>
            <p className="mt-3 text-sm text-slate-600">
              TraceForge gave our on-call teams real-time error context and AI summaries
              that made incidents feel manageable again.
            </p>
            <p className="mt-6 text-xs font-semibold text-slate-500">
              Head of Reliability · AtlasBank
            </p>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-3xl">Ready to make errors boring?</h2>
              <p className="mt-2 text-sm text-slate-600">
                Bring your team into TraceForge and ship with confidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="tf-button px-6 py-3 text-sm" href="/dashboard">
                Start Monitoring
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                View Docs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
