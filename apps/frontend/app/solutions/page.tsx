import Link from "next/link";

const solutions = [
  {
    title: "Engineering leaders",
    description:
      "Track reliability across teams, enforce ownership, and measure incident response."
  },
  {
    title: "Platform teams",
    description:
      "Standardize error collection across services with unified routing and controls."
  },
  {
    title: "Product teams",
    description:
      "Connect errors to customer impact and prioritize what matters most."
  }
];

const industries = [
  "Fintech",
  "Healthcare",
  "Ecommerce",
  "SaaS",
  "Logistics",
  "Media"
];

export default function SolutionsPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="relative mx-auto max-w-6xl">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="tf-kicker">Solutions</p>
            <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
              Built for teams that run high-stakes production systems.
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              TraceForge adapts to your org structure, from single teams to global
              enterprises, with configurable workflows and audit-ready visibility.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/dashboard">
                Get Started
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
                View Docs
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
              <p className="text-xs font-semibold text-slate-500">Enterprise Coverage</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>• Org-level permissions and approvals</p>
                <p>• Audit-ready access logs</p>
                <p>• Custom retention policies</p>
                <p>• Dedicated success support</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {solutions.map((item) => (
            <div key={item.title} className="tf-card p-6">
              <h3 className="tf-section-title">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame-tight">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="tf-kicker">Industries</p>
              <h2 className="tf-title mt-4 text-3xl">Trusted across regulated domains.</h2>
              <p className="mt-3 text-sm text-slate-600">
                TraceForge supports compliance-minded teams with secure data workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {industries.map((industry) => (
                <span key={industry} className="tf-chip">
                  {industry}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
