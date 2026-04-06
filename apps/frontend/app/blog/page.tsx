import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";
import { blogPosts } from "./posts";

export const metadata: Metadata = createPageMetadata({
  title: "Blog",
  description:
    "Read TraceForge insights on reliability engineering, AI-assisted debugging, alerting, and faster incident response.",
  path: "/blog",
  keywords: ["reliability blog", "incident response blog", "AI debugging blog"]
});

export default function BlogPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section>
          <p className="tf-kicker">Blog</p>
          <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
            Insights on reliability, AI, and shipping faster.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-text-secondary">
            Product thinking, engineering lessons, and the ideas shaping how we build
            calmer incident workflows.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "AI summaries + grouped issues",
              "GitHub issue creation + repo analysis",
              "Slack, Jira, and release workflows"
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-card/90 px-4 py-4 text-sm text-text-secondary">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <article key={post.slug} className="tf-card flex h-full flex-col p-6">
              <p className="text-xs font-semibold text-text-secondary">{post.date}</p>
              <h2 className="mt-3 text-lg font-semibold text-text-primary">{post.title}</h2>
              <p className="mt-3 text-sm text-text-secondary">{post.summary}</p>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{post.description}</p>
              <Link className="tf-link mt-5 inline-flex" href={`/blog/${post.slug}`}>
                Read article →
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-border bg-card/90 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-3xl">Stay up to date.</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Explore product updates, release thinking, and reliability lessons from the TraceForge team.
              </p>
            </div>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs">
              Read docs
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
