import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms",
  description:
    "Review the TraceForge terms covering account use, billing, acceptable use, and service responsibilities.",
  path: "/terms",
  keywords: ["terms and conditions", "SaaS terms", "billing terms", "acceptable use"]
});

const sections = [
  {
    title: "Eligibility and account ownership",
    body:
      "You must provide accurate signup information, keep credentials secure, and use TraceForge only for workspaces you are authorized to manage. Workspace owners are responsible for who they invite, how API keys are shared, and how connected integrations are configured."
  },
  {
    title: "Acceptable use",
    body:
      "You may not use the service to submit unlawful content, abuse connected providers, interfere with other customers, reverse engineer restricted parts of the product, or attempt to bypass plan limits, security controls, or account restrictions."
  },
  {
    title: "Plans, billing, and refunds",
    body:
      "Paid subscriptions renew according to the billing interval selected at checkout unless canceled. Pricing, launch offers, and plan limits may change prospectively. Unless required by law or expressly stated otherwise, payments already made are non-refundable, including when an account is deleted during an active paid term."
  },
  {
    title: "Data and service operation",
    body:
      "TraceForge processes telemetry, issue metadata, project configuration, organization membership, and connected workflow data to operate the service. You remain responsible for the legality of the data you send to the platform and for configuring retention, access, and connected systems appropriately."
  },
  {
    title: "Suspension and termination",
    body:
      "We may suspend or terminate accounts that violate these terms, create security risk, abuse the service, or fail to satisfy payment obligations. You may stop using the service at any time, and account deletion requests will remove access to the associated workspace data subject to product behavior and retention rules."
  },
  {
    title: "Service changes and liability",
    body:
      "We may update features, limits, integrations, and supporting infrastructure as the product evolves. To the fullest extent permitted by law, TraceForge is provided on an as-available basis, and indirect or consequential damages are excluded."
  }
];

export default function TermsPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Terms</p>
          <h1 className="tf-title mt-4 text-3xl">TraceForge terms of service</h1>
          <p className="mt-3 text-sm text-text-secondary">Last updated: April 10, 2026</p>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            These terms govern your access to and use of TraceForge. They are intended to set clear
            expectations for product use, billing, workspace control, and service operation. For
            questions about these terms, contact{" "}
            <a className="tf-link" href="mailto:team@usetraceforge.com">
              team@usetraceforge.com
            </a>
            .
          </p>

          <div className="mt-8 grid gap-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-border bg-secondary/20 px-5 py-4"
              >
                <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link className="tf-link" href="/privacy">
              Read the privacy policy
            </Link>
            <Link className="tf-link" href="/security">
              Review security practices
            </Link>
            <Link className="tf-link" href="/signup">
              Back to sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
