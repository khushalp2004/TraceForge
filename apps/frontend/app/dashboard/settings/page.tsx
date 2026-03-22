"use client";

import { useState } from "react";
import Link from "next/link";

type IntegrationName = "Slack" | "PagerDuty" | "Jira";
type Toast = {
  message: string;
  tone: "success" | "error";
};

export default function SettingsPage() {
  const [activeIntegration, setActiveIntegration] = useState<IntegrationName | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header>
          <p className="tf-kicker">Settings</p>
          <h1 className="tf-title mt-3 text-3xl">Workspace settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Manage workspace integrations and operational defaults used across TraceForge.
          </p>
        </header>

        <div className="mt-6 grid gap-6">
          <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Personal account</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Profile, password, reset links, organization leaving, and account deletion now live in a dedicated account details page.
                </p>
              </div>
              <Link
                href="/dashboard/account/details"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
              >
                Open account details
              </Link>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">Workspace integrations</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Connect delivery and collaboration tools used around incident response.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  {
                    name: "Slack" as const,
                    description: "Route alerts and triage updates into shared channels.",
                    action: "Connect"
                  },
                  {
                    name: "PagerDuty" as const,
                    description: "Escalate critical incidents through on-call workflows.",
                    action: "Connect"
                  },
                  {
                    name: "Jira" as const,
                    description: "Turn recurring issues into tracked engineering work.",
                    action: "Connect"
                  }
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/25 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{integration.name}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {integration.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                      onClick={() => setActiveIntegration(integration.name)}
                    >
                      {integration.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">Workspace controls</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Operational defaults and guardrails used across your TraceForge workspace.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  {
                    title: "Audit logs",
                    description: "Track organization approvals, role changes, invites, and team activity."
                  },
                  {
                    title: "Data retention",
                    description: "Archived issues, alerts, and projects are permanently cleaned up after 15 days."
                  },
                  {
                    title: "Security posture",
                    description: "Password recovery, in-app notifications, and alert fanout are enabled for active workspaces."
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-secondary/25 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>

      {activeIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Integration setup
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
              {activeIntegration} connection
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              {activeIntegration === "Slack" &&
                "Slack delivery is planned for channel-based alert routing and team triage updates."}
              {activeIntegration === "PagerDuty" &&
                "PagerDuty delivery is planned for on-call escalation when critical incidents fire."}
              {activeIntegration === "Jira" &&
                "Jira delivery is planned for turning recurring issues into tracked engineering work."}
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Current status
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  Not configured in this workspace yet
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-accent-soft px-4 py-4">
                <p className="text-sm text-text-primary">
                  This button is now intentionally handled. Full OAuth and webhook setup for{" "}
                  {activeIntegration} has not been implemented yet.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={() => setActiveIntegration(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={() => {
                  showToast(`${activeIntegration} integration setup is coming soon`, "success");
                  setActiveIntegration(null);
                }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
