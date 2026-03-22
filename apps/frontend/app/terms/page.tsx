import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms",
  description:
    "Review the current TraceForge terms and conditions for account use, data handling, and billing expectations.",
  path: "/terms",
  keywords: ["terms and conditions", "software terms", "monitoring platform terms"]
});

export default function TermsPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Terms</p>
          <h1 className="tf-title mt-4 text-3xl">Terms and conditions</h1>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            This workspace currently uses a lightweight placeholder terms page for signup flow
            completeness. Before production launch, replace this with your final legal terms,
            privacy commitments, billing conditions, and acceptable-use policy.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              {
                title: "Account responsibility",
                text: "You are responsible for maintaining the confidentiality of your account credentials and workspace access."
              },
              {
                title: "Usage and data",
                text: "TraceForge processes error telemetry, project metadata, and collaboration activity to provide monitoring workflows."
              },
              {
                title: "Billing and retention",
                text: "Paid workspaces may include billing commitments, and archived records may be permanently deleted after the configured retention period."
              }
            ].map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-border bg-secondary/20 px-5 py-4"
              >
                <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{section.text}</p>
              </section>
            ))}
          </div>

          <div className="mt-8">
            <Link className="tf-link" href="/signup">
              Back to sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
