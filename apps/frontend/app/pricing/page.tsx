import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Pricing",
  description:
    "Compare TraceForge pricing for startups, teams, and enterprise reliability programs.",
  path: "/pricing",
  keywords: ["error monitoring pricing", "developer tools pricing", "enterprise observability pricing"]
});

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "For individual builders validating a product.",
    features: ["1 project", "Basic error grouping", "Community support"],
    cta: "Start Free"
  },
  {
    name: "Team",
    price: "$49",
    description: "For fast-moving teams that need collaboration.",
    features: ["Unlimited projects", "Team invites + roles", "AI summaries"],
    cta: "Start Trial"
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Security, compliance, and scale for large orgs.",
    features: ["SAML + SSO", "Audit logs", "Dedicated support"],
    cta: "Contact Sales"
  }
];

export default function PricingPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container">
        <section className="text-center">
          <p className="tf-kicker">Pricing</p>
          <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
            Plans that scale from startup to enterprise.
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            Start free, upgrade as your team grows, and unlock enterprise compliance when
            you need it.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="tf-card p-6">
              <p className="text-xs font-semibold text-text-secondary">{plan.name}</p>
              <p className="mt-3 text-3xl font-semibold text-text-primary">{plan.price}</p>
              <p className="mt-2 text-sm text-text-secondary">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Link className="tf-button mt-6 inline-flex px-4 py-2 text-xs" href="/signup">
                {plan.cta}
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-border bg-card/90 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="tf-title text-3xl">Need a custom plan?</h2>
              <p className="mt-2 text-sm text-text-secondary">
                We can tailor TraceForge for your compliance, security, and scale needs.
              </p>
            </div>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/about">
              Talk to Sales
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
