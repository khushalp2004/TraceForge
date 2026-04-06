import type { Metadata } from "next";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy",
  description:
    "Read how TraceForge handles telemetry, account data, workspace metadata, and connected integrations.",
  path: "/privacy",
  keywords: ["privacy policy", "telemetry privacy", "SaaS privacy"]
});

export default function PrivacyPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Privacy</p>
          <h1 className="tf-title mt-4 text-3xl">Privacy and data handling</h1>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            TraceForge stores the product data needed to capture errors, organize incidents,
            support collaboration, and power connected workflows across projects and organizations.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              {
                title: "What we store",
                text: "Error events, grouped issues, release metadata, project settings, organization membership, and the connected workflow settings needed to operate the product."
              },
              {
                title: "How we use it",
                text: "We use your data to group incidents, generate AI analysis, route alerts, create linked workflow actions, and keep historical context visible across your workspace."
              },
              {
                title: "Your control",
                text: "Projects, issues, alerts, and organizations can be archived or removed through the product, and plan-level settings control retention and access across teams."
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
