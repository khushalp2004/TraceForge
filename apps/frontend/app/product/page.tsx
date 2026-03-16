import Link from "next/link";

export default function ProductPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="relative mx-auto max-w-6xl">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="tf-kicker">Product</p>
            <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
              TraceForge keeps production quiet with AI error intelligence.
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              Capture exceptions across services, group noisy stacks into clean issues, and
              route them to the right teams with enterprise-grade workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/dashboard">
                Open Dashboard
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                View Docs
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
              <p className="text-xs font-semibold text-slate-500">Unified Error View</p>
              <div className="mt-4 space-y-3">
                {[
                  "API: timeout spike after deploy",
                  "Frontend: null pointer on checkout",
                  "Worker: queue backlog exceeded"
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-ink">{item}</p>
                    <p className="mt-1 text-xs text-slate-500">Last seen 3m ago</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
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
              <p className="mt-3 text-sm text-slate-600">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="tf-kicker">Workflow</p>
              <h2 className="tf-title mt-4 text-3xl">From error to resolution in minutes.</h2>
              <p className="mt-4 text-sm text-slate-600">
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
                <div key={item.step} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-blue-700">Step {item.step}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
