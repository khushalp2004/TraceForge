import type { Metadata } from "next";
import { createPageMetadata } from "../seo";
import { PricingPlans } from "./PricingPlans";

export const metadata: Metadata = createPageMetadata({
  title: "Pricing",
  description:
    "Compare TraceForge pricing for startups, teams, and enterprise reliability programs.",
  path: "/pricing",
  keywords: ["error monitoring pricing", "developer tools pricing", "enterprise observability pricing"]
});

export default function PricingPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section className="text-center">
          <p className="tf-kicker">Pricing</p>
          <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
            Simple pricing that scales with you.
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            Start free, upgrade to Pro for personal unlimited AI, or choose Team for shared organization capacity.
          </p>
        </section>

        <PricingPlans />

        <section className="mt-16 rounded-3xl border border-border bg-card/90 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-3xl">Need a custom plan?</h2>
              <p className="mt-2 text-sm text-text-secondary">
                We can tailor TraceForge for your compliance, security, and scale needs.
              </p>
            </div>
            <a className="tf-button-ghost px-6 py-3 text-sm" href="mailto:sales@usetraceforge.com">
              Talk to Sales
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
