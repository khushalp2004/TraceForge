import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "About",
  description:
    "Read the story behind TraceForge, why we built it, and how we designed it to help teams respond to production issues with confidence.",
  path: "/about",
  keywords: ["about TraceForge", "why TraceForge", "reliability product story"]
});

const storyBlocks = [
  {
    title: "Why we built it",
    text:
      "Too many teams still bounce between logs, alerts, and chat threads before they can answer a simple question: what broke, who owns it, and what changed? We built TraceForge to remove that first layer of chaos."
  },
  {
    title: "How we built it",
    text:
      "We focused on the workflow after the exception lands: grouping noisy events, adding release context, generating AI guidance, and making ownership visible across projects and organizations."
  },
  {
    title: "What success looks like",
    text:
      "Success is a quieter release day. The team sees the signal early, understands the likely cause, routes it quickly, and resolves it before the incident becomes a customer story."
  }
];

const buildPrinciples = [
  "Clarity before dashboards",
  "AI that reduces toil",
  "Ownership that stays visible",
  "Reliability that feels collaborative"
];

const milestones = [
  {
    label: "Capture",
    text: "Bring frontend, backend, and worker failures into one stream."
  },
  {
    label: "Understand",
    text: "Group duplicates, add release context, and surface the likely cause."
  },
  {
    label: "Coordinate",
    text: "Route through projects, alerts, members, and organizations."
  },
  {
    label: "Improve",
    text: "Learn from recurring issues and ship calmer releases next time."
  }
];

export default function AboutPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="tf-kicker">About</p>
            <h1 className="tf-title mt-4 text-3xl sm:text-4xl lg:text-5xl">
              We built TraceForge to make production issues easier to understand.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
              TraceForge started with a simple frustration: teams were spending too much
              energy collecting context and not enough energy fixing the problem. We wanted
              one place where errors could arrive, get cleaned up, gain meaning, and move
              toward resolution.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/signup">
                Try TraceForge
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/blog">
                Read our thinking
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Our belief
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-text-primary">
              Reliability should feel like momentum, not overhead.
            </h2>
            <div className="mt-6 space-y-3">
              {buildPrinciples.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/60 px-4 py-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-text-primary">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {storyBlocks.map((item) => (
            <div key={item.title} className="tf-card p-6">
              <h2 className="tf-section-title">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 tf-frame">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="tf-kicker">Our story</p>
              <h2 className="tf-title mt-4 text-3xl">We designed the product around the real moment of stress.</h2>
              <p className="mt-4 text-sm leading-6 text-text-secondary">
                The first few minutes after an incident matter the most. That is the point
                where teams either gather around one shared understanding or lose time
                reconstructing the same context in three different places. TraceForge is
                built to make that moment smaller, calmer, and easier to move through.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {milestones.map((item, index) => (
                <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Step {index + 1}
                  </p>
                  <p className="mt-3 text-base font-semibold text-text-primary">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="tf-kicker">Success scenario</p>
              <h2 className="tf-title mt-4 text-2xl sm:text-3xl">
                The best outcome is that the team feels in control.
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
                A deploy goes out, error volume shifts, the issue is grouped instantly,
                the AI summary points to the likely regression, the alert reaches the right
                owner, and the fix ships before the incident becomes a support escalation.
                That is the kind of successful engineering rhythm we are building for.
              </p>
            </div>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/solutions">
              See how teams use it
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
