"use client";

import { useState } from "react";
import Link from "next/link";

const installSnippet = `npm install traceforge-js`;

const initSnippet = `import TraceForge from "traceforge-js";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true,
  environment: "production",
  release: "web@1.4.2"
});`;

const captureSnippet = `try {
  throw new Error("Payment request failed");
} catch (error) {
  TraceForge.captureException(error, {
    environment: "production",
    release: "web@1.4.2",
    payload: {
      route: "/checkout",
      userId: "usr_123",
      release: "web@1.4.2"
    }
  });
}`;

const ingestSnippet = `POST /ingest
Authorization: Bearer <PROJECT_API_KEY>
Content-Type: application/json

{
  "message": "Database connection timeout",
  "stackTrace": "Error: Database connection timeout\\n    at connect (/app/db.ts:17:13)",
  "environment": "production",
  "release": "api@2.8.0",
  "payload": {
    "service": "billing-api",
    "region": "us-east-1",
    "release": "api@2.8.0"
  }
}`;

const sidebarSections = [
  "Quickstart",
  "SDK setup",
  "Payload shape",
  "Release tagging",
  "Environments",
  "What happens next",
  "Troubleshooting"
];

type Toast = {
  message: string;
  tone: "success" | "error";
};

function SnippetBlock({
  title,
  code,
  onCopy
}: {
  title: string;
  code: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
          onClick={() => onCopy(code)}
        >
          Copy
        </button>
      </div>
      <div className="mt-3 max-w-full overflow-hidden rounded-2xl bg-ink">
        <pre className="max-w-full overflow-x-auto p-4 text-sm text-white/90">
          <code className="block w-max min-w-full whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2200);
  };

  const copySnippet = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Snippet copied", "success");
    } catch {
      showToast("Failed to copy snippet", "error");
    }
  };

  const copyAllSnippets = async () => {
    await copySnippet([installSnippet, initSnippet, captureSnippet, ingestSnippet].join("\n\n"));
  };

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-6xl">
        <header className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="tf-kicker">Docs</p>
            <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
              Developer docs for getting TraceForge live fast.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-text-secondary">
              Install the SDK, send your first exception, tag releases and environments,
              and understand how issues, alerts, and release health connect inside the app.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/signup">
                Start in dashboard
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/product">
                Explore product
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-text-secondary">
              {["JavaScript", "Node.js", "Next.js", "REST ingest", "Docker", "Release tags"].map(
                (item) => (
                  <span key={item} className="tf-chip">
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              In this guide
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Install and initialize the SDK",
                "Capture a test error with full context",
                "Tag releases and environments correctly",
                "Understand how issues and alerts are created"
              ].map((item) => (
                <div
                  key={item}
                  className="min-w-0 rounded-2xl border border-border bg-secondary/25 px-4 py-3 text-sm text-text-secondary"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              label: "Time to first event",
              value: "5 min",
              hint: "From project creation to first ingested error"
            },
            {
              label: "Core requirement",
              value: "API key",
              hint: "Every project ingests through a project-scoped key"
            },
            {
              label: "Best practice",
              value: "Release + env tags",
              hint: "They unlock cleaner triage and release correlation"
            }
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-card/90 px-5 py-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{item.value}</p>
              <p className="mt-2 text-sm text-text-secondary">{item.hint}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                On this page
              </p>
              <div className="mt-3 space-y-2">
                {sidebarSections.map((section, index) => (
                  <div
                    key={section}
                    className="flex items-center justify-between gap-3 text-sm text-text-secondary"
                  >
                    <span>0{index + 1}</span>
                    <span className="min-w-0 text-right font-medium text-text-primary">
                      {section}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Popular tasks
              </p>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>Install SDK in a web app</p>
                <p>Send backend errors directly</p>
                <p>Attach release markers to deploys</p>
                <p>Verify grouped issues in dashboard</p>
                <p>Set alerts after first ingestion</p>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-accent-soft p-4 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">Need the API key?</p>
              <p className="mt-2 text-sm text-text-secondary">
                Create a project in the dashboard and copy the project API key before initializing the SDK.
              </p>
              <Link className="tf-link mt-3 inline-flex" href="/dashboard/projects">
                Open projects →
              </Link>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Quickstart
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                    Get your first issue into TraceForge
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  4 essential steps
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { step: "01", title: "Create project", text: "Generate a project API key from the dashboard." },
                  { step: "02", title: "Install SDK", text: "Add the client library or send REST ingest calls." },
                  { step: "03", title: "Capture error", text: "Send a real exception with environment and release tags." },
                  { step: "04", title: "Verify issue", text: "Confirm the issue appears in the Issues page and dashboard." }
                ].map((item) => (
                  <div key={item.step} className="min-w-0 rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {item.step}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    SDK setup
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">Install and initialize</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                  onClick={copyAllSnippets}
                >
                  Copy snippets
                </button>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Install" code={installSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Initialize" code={initSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-secondary/15 px-4 py-4">
                <p className="text-sm font-semibold text-text-primary">Required fields</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {[
                    { key: "apiKey", value: "Project-scoped key from dashboard" },
                    { key: "endpoint", value: "Your TraceForge ingest endpoint" },
                    { key: "environment", value: "production, staging, development, browser" }
                  ].map((item) => (
                    <div key={item.key} className="rounded-2xl border border-border bg-card px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                        {item.key}
                      </p>
                      <p className="mt-2 text-sm text-text-primary">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Payload shape
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">Capture rich context</h2>
              <p className="mt-2 text-sm text-text-secondary">
                The more stable context you attach, the easier it is for TraceForge to group,
                analyze, and correlate issues with releases and environments.
              </p>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Client capture example" code={captureSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Direct ingest example" code={ingestSnippet} onCopy={copySnippet} />
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-semibold text-text-primary">Release tagging</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Send a stable release identifier like `web@1.4.2` or `api@2.8.0`.
                    TraceForge uses it to build the Releases page and correlate deploys with issue spikes.
                  </p>
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-sm text-text-primary">
                    Best practice: use the same release tag in SDK config and per-event payloads.
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-semibold text-text-primary">Environment tagging</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Set `environment` consistently so dashboard filters, alerts, and issue triage
                    can separate production incidents from staging or browser noise.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["production", "staging", "development", "browser"].map((item) => (
                      <span key={item} className="tf-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                What happens next
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">
                How the platform uses your data
              </h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  {
                    title: "Issues are grouped",
                    text: "Repeated errors are merged into a cleaner issue stream instead of showing every event individually."
                  },
                  {
                    title: "AI summaries are added",
                    text: "Issue detail pages can generate explanations to speed up first-pass triage."
                  },
                  {
                    title: "Alerts can be layered on top",
                    text: "Manual alert rules watch the ingested issue flow and notify people when thresholds are met."
                  },
                  {
                    title: "Releases add deploy context",
                    text: "Tagged releases help teams understand whether a deploy may have introduced new incidents."
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Troubleshooting
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">
                If events are not showing up
              </h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Check that the project API key matches the project you expect.",
                  "Verify the ingest endpoint is reachable from your app or service.",
                  "Confirm `environment` and `release` are strings, not nested objects only.",
                  "Look at the Issues page first, then Alerts if you expect a threshold-based notification.",
                  "If you are using local Docker, make sure backend, frontend, and worker are all running."
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-text-secondary">
                      {index + 1}
                    </span>
                    <p className="text-sm text-text-secondary">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
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
