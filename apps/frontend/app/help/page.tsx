import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";
import HelpForm from "./HelpForm";

export const metadata: Metadata = createPageMetadata({
  title: "Help",
  description:
    "Start with the quickest ways to set up TraceForge, connect workflows, and move through common product questions.",
  path: "/help",
  keywords: ["help center", "support", "quickstart", "traceforge help"]
});

export default function HelpPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-5xl">
        <HelpForm />

        <div className="mt-8 rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Self-serve first</p>
          <h2 className="tf-title mt-4 text-2xl">Common paths we recommend before waiting on email</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Get started",
                text: "Install the SDK, connect a project, and verify your first error reaches the inbox.",
                href: "/docs"
              },
              {
                title: "Connect workflows",
                text: "Set up GitHub, Slack, and Jira so the product can carry context into the rest of your workflow.",
                href: "/dashboard/settings"
              },
              {
                title: "Understand plans",
                text: "Compare Free, Pro, and Team usage so you know how AI analysis and organizations scale.",
                href: "/pricing"
              }
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-border bg-secondary/20 px-5 py-5 transition hover:border-primary/20 hover:bg-secondary/35"
              >
                <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.text}</p>
                <p className="mt-4 text-sm font-semibold text-primary">Open →</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
