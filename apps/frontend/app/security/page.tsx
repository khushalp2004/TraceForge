import type { Metadata } from "next";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Security & Compliance",
  description:
    "Review the security posture, collaboration controls, and compliance direction behind TraceForge.",
  path: "/security",
  keywords: ["security", "compliance", "audit logs", "access controls"]
});

export default function SecurityPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Security & Compliance</p>
          <h1 className="tf-title mt-4 text-3xl">Built for controlled incident workflows</h1>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            TraceForge is designed around project boundaries, organization ownership, audit visibility,
            and practical controls that make incident response easier to govern as teams grow.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              {
                title: "Access control",
                text: "Projects and organizations keep ownership explicit, with invitations, approvals, role-based membership, and account-scoped billing and usage behavior."
              },
              {
                title: "Operational visibility",
                text: "Audit-style activity, notifications, alert history, and billing history help teams understand who changed what and when inside the workspace."
              },
              {
                title: "Compliance direction",
                text: "TraceForge is built with enterprise-minded controls such as retention-aware workflows, legal pages, and workspace-scoped integrations, with room to formalize further compliance programs as the product grows."
              }
            ].map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-border bg-secondary/20 px-5 py-4"
              >
                <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{section.text}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
