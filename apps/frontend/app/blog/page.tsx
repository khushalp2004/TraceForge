import Link from "next/link";

const posts = [
  {
    title: "Introducing TraceForge AI summaries",
    date: "Mar 10, 2026",
    summary: "Root-cause explanations that keep every team aligned."
  },
  {
    title: "Reducing alert fatigue with better grouping",
    date: "Feb 28, 2026",
    summary: "How we cluster noisy stacks into actionable issues."
  },
  {
    title: "Enterprise readiness checklist",
    date: "Feb 12, 2026",
    summary: "Security and compliance practices that scale with your org."
  }
];

export default function BlogPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="relative mx-auto max-w-6xl">
        <section>
          <p className="tf-kicker">Blog</p>
          <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
            Insights on reliability, AI, and shipping faster.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Product updates, engineering deep dives, and best practices from the
            TraceForge team.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.title} className="tf-card p-6">
              <p className="text-xs font-semibold text-slate-500">{post.date}</p>
              <h2 className="mt-3 text-lg font-semibold text-ink">{post.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{post.summary}</p>
              <Link className="tf-link mt-4 inline-flex" href="/docs">
                Read more →
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-3xl">Stay up to date.</h2>
              <p className="mt-2 text-sm text-slate-600">
                Subscribe for release updates and reliability insights.
              </p>
            </div>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
              Subscribe
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
