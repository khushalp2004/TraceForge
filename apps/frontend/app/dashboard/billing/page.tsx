"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
  archivedAt?: string | null;
};

type Org = {
  id: string;
  name: string;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const invoices = [
  {
    id: "inv_mar_2026",
    label: "March 2026",
    amount: "$49.00",
    status: "Paid",
    issuedAt: "2026-03-01"
  },
  {
    id: "inv_feb_2026",
    label: "February 2026",
    amount: "$49.00",
    status: "Paid",
    issuedAt: "2026-02-01"
  },
  {
    id: "inv_jan_2026",
    label: "January 2026",
    amount: "$49.00",
    status: "Paid",
    issuedAt: "2026-01-01"
  }
];

const usageBar = (used: number, limit: number) => `${Math.min(100, Math.round((used / limit) * 100))}%`;

export default function BillingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return;
    }

    const loadBillingContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const [projectsRes, orgsRes] = await Promise.all([
          fetch(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/orgs`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const [projectsData, orgsData] = await Promise.all([
          projectsRes.json(),
          orgsRes.json()
        ]);

        if (!projectsRes.ok) {
          throw new Error(projectsData.error || "Failed to load projects");
        }

        if (!orgsRes.ok) {
          throw new Error(orgsData.error || "Failed to load organizations");
        }

        setProjects(projectsData.projects || []);
        setOrgs(orgsData.orgs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    void loadBillingContext();
  }, []);

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt),
    [projects]
  );

  const usageCards = useMemo(
    () => [
      {
        label: "Monitored projects",
        used: activeProjects.length,
        limit: 10,
        hint: "Projects actively sending events into TraceForge"
      },
      {
        label: "Organizations",
        used: orgs.length,
        limit: 5,
        hint: "Shared workspaces covered in this plan"
      },
      {
        label: "AI analyses",
        used: Math.max(12, activeProjects.length * 18),
        limit: 250,
        hint: "Monthly AI-assisted error explanations"
      },
      {
        label: "Alert rules",
        used: Math.max(4, orgs.length * 2 + activeProjects.length),
        limit: 50,
        hint: "Manual alert coverage across projects and organizations"
      }
    ],
    [activeProjects.length, orgs.length]
  );

  const nextInvoiceDate = "April 1, 2026";

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Billing</p>
            <h1 className="tf-title mt-3 text-3xl">Plan and usage</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Manage your subscription, review usage against plan limits, and keep billing
              details organized for your workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="tf-button px-4 py-2 text-sm"
              onClick={() => showToast("Plan management is coming soon", "success")}
            >
              Manage plan
            </button>
            <button
              type="button"
              className="tf-button-ghost px-4 py-2 text-sm"
              onClick={() => showToast("Invoice center is coming soon", "success")}
            >
              Download invoices
            </button>
          </div>
        </header>

        {error && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Current plan
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-text-primary">Team</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Built for growing organizations that need shared alerting, project coverage,
                  and AI-assisted triage.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Renewal
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{nextInvoiceDate}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Monthly price
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">$49</p>
                <p className="mt-1 text-sm text-text-secondary">per workspace / month</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Billing owner
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Workspace owners</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Organization owners can manage shared billing
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Payment method
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Visa ending in 4242</p>
                <p className="mt-1 text-sm text-text-secondary">Expires 08/2028</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">Billing summary</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Subscription status
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Active and renewing</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Billing contact
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  finance@traceforge.dev
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Tax region
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">United States</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => showToast("Payment method editor is coming soon", "success")}
              >
                Update card
              </button>
              <button
                type="button"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => showToast("Billing contact editor is coming soon", "success")}
              >
                Edit billing contact
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Usage and limits</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Keep an eye on workspace usage before you hit plan limits.
              </p>
            </div>
            <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
              Current billing cycle
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {usageCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border bg-secondary/20 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">{card.label}</p>
                  <p className="text-sm font-semibold text-text-secondary">
                    {card.used} / {card.limit}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: usageBar(card.used, card.limit) }}
                  />
                </div>
                <p className="mt-3 text-sm text-text-secondary">{card.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
          <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Invoices</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Review historical charges and invoice status for this workspace.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => showToast("Invoice export is coming soon", "success")}
              >
                Export
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{invoice.label}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Issued {new Date(invoice.issuedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {invoice.status}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">{invoice.amount}</span>
                    <button
                      type="button"
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                      onClick={() => showToast(`Invoice ${invoice.label} download is coming soon`, "success")}
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">Plan comparison</h2>
              <div className="mt-5 space-y-3">
                {[
                  {
                    name: "Starter",
                    detail: "Single workspace with lighter event and AI usage",
                    action: "Downgrade"
                  },
                  {
                    name: "Team",
                    detail: "Current plan with organization support and alert coverage",
                    action: "Current plan"
                  },
                  {
                    name: "Scale",
                    detail: "Higher ingest limits, stronger billing controls, and priority support",
                    action: "Upgrade"
                  }
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className="rounded-2xl border border-border bg-secondary/20 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
                        <p className="mt-1 text-sm text-text-secondary">{plan.detail}</p>
                      </div>
                      <button
                        type="button"
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          plan.action === "Current plan"
                            ? "border border-primary/30 bg-accent-soft text-text-primary"
                            : "border border-border bg-card text-text-secondary hover:bg-secondary/70 hover:text-text-primary"
                        }`}
                        onClick={() => showToast(`${plan.action} flow is coming soon`, "success")}
                      >
                        {plan.action}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tf-danger-surface rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">Billing controls</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Sensitive billing actions should stay deliberate and owner-controlled.
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[hsl(var(--destructive-border))] bg-card/80 px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Cancel renewal</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Stop renewal at the end of the current billing cycle without losing access immediately.
                  </p>
                </div>
                <button
                  type="button"
                  className="tf-danger-button rounded-full border px-4 py-2 text-sm font-semibold transition"
                  onClick={() => showToast("Cancellation flow is coming soon", "error")}
                >
                  Cancel plan
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

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
