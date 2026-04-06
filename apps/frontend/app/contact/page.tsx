import type { Metadata } from "next";
import { createPageMetadata } from "../seo";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@usetraceforge.com";

export const metadata: Metadata = createPageMetadata({
  title: "Contact Us",
  description:
    "Reach the TraceForge team for product questions, onboarding help, partnerships, or workspace support.",
  path: "/contact",
  keywords: ["contact", "support email", "sales contact", "traceforge contact"]
});

export default function ContactPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Contact us</p>
          <h1 className="tf-title mt-4 text-3xl">Talk to the TraceForge team</h1>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            If you need help with setup, billing, onboarding, or product questions, the fastest
            path is email. Include your workspace or project name when relevant so we can help you faster.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <a
              href={`mailto:${supportEmail}`}
              className="rounded-2xl border border-border bg-secondary/20 px-5 py-5 transition hover:border-primary/20 hover:bg-secondary/35"
            >
              <h2 className="text-lg font-semibold text-text-primary">Email support</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{supportEmail}</p>
            </a>
            <div className="rounded-2xl border border-border bg-secondary/20 px-5 py-5">
              <h2 className="text-lg font-semibold text-text-primary">Best for</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Setup help, pricing questions, integration support, onboarding, and product feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
