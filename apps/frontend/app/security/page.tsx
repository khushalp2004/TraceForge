import type { Metadata } from "next";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Security & Compliance",
  description:
    "Review the current TraceForge security controls, disclosure path, and compliance posture.",
  path: "/security",
  keywords: ["security", "compliance", "responsible disclosure", "security posture"]
});

const sections = [
  {
    title: "Current security controls",
    body:
      "TraceForge uses authenticated workspace access, email verification, rate limiting, hashed and encrypted project API key storage, encrypted integration secrets, request validation, and queue separation between the API and background processing flows."
  },
  {
    title: "Browser and session protection",
    body:
      "Customer-facing pages ship with browser security headers, and authenticated sessions now use HttpOnly cookies rather than storing access tokens in browser-accessible local storage. This reduces token exposure if client-side JavaScript is compromised."
  },
  {
    title: "Operational visibility",
    body:
      "The platform includes health endpoints, request identifiers, worker heartbeats, billing records, notification history, and admin controls to improve incident investigation and operational awareness."
  },
  {
    title: "Responsible disclosure",
    body:
      "If you believe you have identified a security issue, email team@usetraceforge.com with reproduction details, impact, and affected endpoints. Please avoid destructive testing, privacy violations, and denial-of-service activity."
  },
  {
    title: "Compliance status",
    body:
      "TraceForge is building toward a stronger security program, but it does not currently claim SOC 2, ISO 27001, formal penetration-test certification, or universal WAF coverage out of the box. Some perimeter protections remain deployment-dependent and should be configured as part of production hosting."
  },
  {
    title: "Shared responsibility",
    body:
      "Customers remain responsible for the telemetry they send, the integration scopes they approve, the security of their own environments, and infrastructure-layer protections such as WAF, network policy, backups, and access governance in the environments where they deploy TraceForge."
  }
];

export default function SecurityPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
          <p className="tf-kicker">Security & Compliance</p>
          <h1 className="tf-title mt-4 text-3xl">Current security posture</h1>
          <p className="mt-3 text-sm text-text-secondary">Last updated: April 10, 2026</p>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            This page describes the security controls currently built into TraceForge and the parts
            of the program that still depend on deployment and ongoing operational work. We want
            this page to be honest, specific, and useful rather than overstated.
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
