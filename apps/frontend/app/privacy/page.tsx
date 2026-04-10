import type { Metadata } from "next";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy",
  description:
    "Read how TraceForge collects, uses, stores, and protects account, telemetry, and integration data.",
  path: "/privacy",
  keywords: ["privacy policy", "telemetry privacy", "SaaS privacy", "data processing"]
});

const sections = [
  {
    title: "Information we collect",
    body:
      "TraceForge stores account details, organization membership, project settings, alert rules, billing metadata, issue data, release metadata, and the telemetry you intentionally send to the platform. Connected integrations may also provide account identifiers, repository metadata, workspace identifiers, and access tokens required to perform approved actions."
  },
  {
    title: "How we use information",
    body:
      "We use this information to authenticate users, group and analyze issues, generate AI summaries, route alerts, maintain billing and plan state, and operate product workflows such as GitHub, Slack, and Jira actions."
  },
  {
    title: "How information is shared",
    body:
      "We share data only with service providers and infrastructure partners needed to operate the product, such as hosting, database, email, payment, and connected workflow providers. We do not sell customer data."
  },
  {
    title: "Retention and deletion",
    body:
      "Workspace data is retained while the account or organization remains active, subject to product behavior and any retention settings or plan limits in effect. Users can remove projects, organizations, and accounts through the product, and those actions may permanently remove related data."
  },
  {
    title: "Security and access",
    body:
      "We use layered access controls, encrypted secrets, rate limiting, and authentication checks to reduce risk. No internet service can guarantee absolute security, so customers should also manage access carefully, rotate credentials when needed, and avoid sending unnecessary sensitive data in telemetry."
  },
  {
    title: "Questions and requests",
    body:
      "For privacy questions, data requests, or security concerns, contact team@usetraceforge.com. We review requests in good faith and respond according to our operational capacity and legal obligations."
  }
];

export default function PrivacyPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Privacy</p>
          <h1 className="tf-title mt-4 text-3xl">Privacy and data handling</h1>
          <p className="mt-3 text-sm text-text-secondary">Last updated: April 10, 2026</p>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            This policy explains the categories of data TraceForge handles, why that data is used,
            and the practical controls we apply as part of operating the service.
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
        </div>
      </div>
    </main>
  );
}
