"use client";

import { useState } from "react";
import Link from "next/link";

const installFrontendSnippet = `cd frontend
npm install usetraceforge`;

const installBackendSnippet = `cd backend
npm install usetraceforge`;

const configurationSnippet = `Backend is configured when:
- TraceForge middleware is installed before the final Express error handler
- API key, environment, and release values are read from env
- The backend helper forwards errors with route and method context

Frontend is configured when:
- ingest URL, API key, environment, and release are available from env
- browser auto-capture is enabled for window.error and unhandledrejection
- a helper exists for handled exceptions and failed requests

Build support is configured when:
- required dependencies are installed
- env typings are present where needed
- TypeScript and bundler settings allow env-based imports to compile cleanly`;

const frontendEnvSnippet = `VITE_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
VITE_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
VITE_TRACEFORGE_ENV=production
VITE_TRACEFORGE_RELEASE=web@1.0.0`;

const frontendSetupSnippet = `import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true,
  environment: import.meta.env.VITE_TRACEFORGE_ENV,
  release: import.meta.env.VITE_TRACEFORGE_RELEASE
});`;

const nextEnvSnippet = `NEXT_PUBLIC_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
NEXT_PUBLIC_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
NEXT_PUBLIC_TRACEFORGE_ENV=production
NEXT_PUBLIC_TRACEFORGE_RELEASE=web@1.0.0`;

const nextSetupSnippet = `"use client";

import { useEffect } from "react";
import TraceForge from "usetraceforge";

let initialized = false;

export function TraceForgeInit() {
  useEffect(() => {
    if (initialized) return;

    TraceForge.init({
      apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY!,
      endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL,
      autoCapture: true,
      environment: process.env.NEXT_PUBLIC_TRACEFORGE_ENV,
      release: process.env.NEXT_PUBLIC_TRACEFORGE_RELEASE
    });

    initialized = true;
  }, []);

  return null;
}`;

const backendEnvSnippet = `TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_ENV=production
TRACEFORGE_RELEASE=api@1.0.0`;

const backendSetupSnippet = `import express from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY!,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});

const app = express();

app.use((error, req, _res, next) => {
  TraceForge.captureException(error, {
    payload: {
      route: req.originalUrl,
      method: req.method
    }
  }).catch(() => undefined);

  next(error);
});`;

const frontendJavaScriptSnippet = `import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true,
  environment: import.meta.env.VITE_TRACEFORGE_ENV,
  release: import.meta.env.VITE_TRACEFORGE_RELEASE
});

export function sendToTraceForge(error, extra = {}) {
  return TraceForge.captureException(
    error instanceof Error ? error : new Error(String(error)),
    { payload: extra }
  );
}`;

const frontendTypeScriptSnippet = `import TraceForge from "usetraceforge";

type TraceForgeExtra = Record<string, unknown>;

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true,
  environment: import.meta.env.VITE_TRACEFORGE_ENV,
  release: import.meta.env.VITE_TRACEFORGE_RELEASE
});

export async function sendToTraceForge(error: unknown, extra: TraceForgeExtra = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  await TraceForge.captureException(err, { payload: extra });
}`;

const backendJavaScriptSnippet = `import express from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});
`;

const backendTypeScriptSnippet = `import express, { NextFunction, Request, Response } from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY!,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});

const app = express();

app.use(async (error: unknown, req: Request, _res: Response, next: NextFunction) => {
  const err = error instanceof Error ? error : new Error(String(error));
  await TraceForge.captureException(err, {
    payload: { route: req.originalUrl, method: req.method }
  });

  next(error);
});`;

const verifySnippet = `try {
  throw new Error("TraceForge setup test");
} catch (error) {
  TraceForge.captureException(error, {
    payload: { route: "/setup-check", source: "manual-test" }
  });
}`;

const helperSnippet = `export async function sendToTraceForge(error, extra = {}) {
  const err = error instanceof Error ? error : new Error(String(error));

  await fetch("http://localhost:3001/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Traceforge-Key": process.env.TRACEFORGE_API_KEY
    },
    body: JSON.stringify({
      message: err.message,
      stackTrace: err.stack || "",
      environment: "production",
      release: "web@1.0.0",
      payload: extra
    })
  });
}`;

const ingestSnippet = `POST /ingest
X-Traceforge-Key: <PROJECT_API_KEY>
Content-Type: application/json

{
  "message": "Database connection timeout",
  "stackTrace": "Error: Database connection timeout\\n    at connect (/app/db.ts:17:13)",
  "environment": "production",
  "release": "api@2.8.0",
  "payload": {
    "service": "billing-api",
    "region": "us-east-1"
  }
}`;

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
    <div className="min-w-0 rounded-2xl border border-border bg-secondary/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <button
          type="button"
          className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
          onClick={() => onCopy(code)}
        >
          Copy
        </button>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl bg-ink">
        <pre className="overflow-x-auto p-4 text-xs text-white/90 sm:text-sm">
          <code className="block w-max min-w-full whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  summary,
  children
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-text-primary">{title}</p>
          <p className="mt-2 text-sm text-text-secondary">{summary}</p>
        </div>
        <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary transition group-open:bg-card group-open:text-text-primary">
          Open
        </span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

export default function DocsPage() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [setupView, setSetupView] = useState<"frontend" | "backend">("frontend");

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

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-5xl">
        <header className="rounded-[36px] border border-border bg-card/95 p-6 shadow-sm sm:p-8">
          <p className="tf-kicker">Docs</p>
          <h1 className="tf-title mt-4 max-w-3xl text-4xl sm:text-5xl">
            Get TraceForge live without digging through a wall of docs.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-text-secondary">
            Install the SDK, add your project API key, initialize once, and send your first real
            exception. Everything else can stay optional until you need it.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link className="tf-button px-6 py-3 text-sm" href="/signup">
              Start in dashboard
            </Link>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs/reference">
              Open full reference
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Time to first event",
                value: "5 min",
                hint: "Create project → add key → send one test error"
              },
              {
                label: "What you need",
                value: "Project API key",
                hint: "Every app sends with a project-scoped key"
              },
              {
                label: "Best signal quality",
                value: "Release + environment",
                hint: "Makes issues, alerts, and releases much clearer"
              }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-secondary/15 px-5 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{item.value}</p>
                <p className="mt-2 text-sm text-text-secondary">{item.hint}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Quick start
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                The shortest path to a working setup
              </h2>
            </div>
            <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
              4 steps
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {[
                {
                  step: "01",
                  title: "Create a project",
                  text: "Open the dashboard and copy the project API key."
                },
                {
                  step: "02",
                  title: "Install the SDK",
                  text: "Install `usetraceforge` in the frontend app, backend app, or both."
                },
                {
                  step: "03",
                  title: "Initialize once",
                  text: "Call `TraceForge.init(...)` at startup with env values."
                },
                {
                  step: "04",
                  title: "Send one test error",
                  text: "Trigger one controlled exception and confirm it appears in Issues."
                }
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-border bg-secondary/15 p-4">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-accent-soft text-sm font-semibold text-primary">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-text-primary">{item.title}</p>
                      <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              <SnippetBlock title="Install in frontend" code={installFrontendSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Install in backend" code={installBackendSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Manual verification" code={verifySnippet} onCopy={copySnippet} />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Setup
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                Pick the part you are wiring right now
              </h2>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/20 p-1 text-xs font-semibold text-text-secondary">
              <button
                type="button"
                onClick={() => setSetupView("frontend")}
                className={`rounded-full px-3 py-1.5 transition ${
                  setupView === "frontend"
                    ? "bg-card text-text-primary shadow-sm"
                    : "hover:bg-secondary/40"
                }`}
              >
                Frontend
              </button>
              <button
                type="button"
                onClick={() => setSetupView("backend")}
                className={`rounded-full px-3 py-1.5 transition ${
                  setupView === "backend"
                    ? "bg-card text-text-primary shadow-sm"
                    : "hover:bg-secondary/40"
                }`}
              >
                Backend
              </button>
            </div>
          </div>

          {setupView === "frontend" ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Vite env example" code={frontendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Vite init" code={frontendSetupSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Next.js env example" code={nextEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Next.js init component" code={nextSetupSnippet} onCopy={copySnippet} />
              </div>
              <div className="rounded-2xl border border-primary/15 bg-accent-soft p-4">
                <p className="text-sm font-semibold text-text-primary">Keep it simple</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Initialize once in your main browser entrypoint or root layout. Auto-capture
                  handles uncaught browser errors and unhandled promise rejections. Use
                  `captureException(...)` for caught errors you still want visible.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Backend env example" code={backendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend init" code={backendSetupSnippet} onCopy={copySnippet} />
              </div>
              <div className="rounded-2xl border border-primary/15 bg-accent-soft p-4">
                <p className="text-sm font-semibold text-text-primary">One important rule</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Install TraceForge before your final Express error handler. If the last handler
                  responds first, TraceForge will not see the real server error path.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0 rounded-3xl border border-border bg-card/95 p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Operational checklist
            </p>
            <h2 className="mt-2 break-words text-xl font-semibold text-text-primary sm:text-2xl">
              What a fully configured app looks like
            </h2>
            <div className="mt-5">
              <SnippetBlock title="Configuration checklist" code={configurationSnippet} onCopy={copySnippet} />
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-border bg-card/95 p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Need exact file paths?
            </p>
            <h2 className="mt-2 break-words text-xl font-semibold text-text-primary sm:text-2xl">
              Use the full reference page
            </h2>
            <p className="mt-4 text-sm leading-7 text-text-secondary">
              The main docs now focus on the shortest working path. If you want exact file names,
              full Express + Vite examples, and more detailed reference material, use the dedicated
              reference page.
            </p>
            <div className="mt-6">
              <Link
                className="tf-button-ghost inline-flex w-full justify-center px-6 py-3 text-sm sm:w-auto"
                href="/docs/reference"
              >
                Open reference
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-4">
          <CollapsibleSection
            title="JavaScript and TypeScript examples"
            summary="Open this if you want language-specific helper examples for frontend and backend."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <SnippetBlock title="Frontend JavaScript" code={frontendJavaScriptSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Frontend TypeScript" code={frontendTypeScriptSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Backend JavaScript" code={backendJavaScriptSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Backend TypeScript" code={backendTypeScriptSnippet} onCopy={copySnippet} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Testing and direct ingest"
            summary="Open this if you want a shared helper, manual payload examples, or a direct REST ingest flow."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <SnippetBlock title="Shared helper" code={helperSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Direct ingest example" code={ingestSnippet} onCopy={copySnippet} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Release and environment tagging"
            summary="Open this if you want cleaner release health, better grouping, and better filtering."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="text-sm font-semibold text-text-primary">Release tagging</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Send a stable release like `web@1.4.2` or `api@2.8.0` on every event so
                  TraceForge can correlate deploys with issue spikes.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="text-sm font-semibold text-text-primary">Environment tagging</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Keep environments consistent — for example `production`, `staging`, and
                  `development` — so triage stays clean.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Troubleshooting"
            summary="Open this if events are not showing up or setup feels correct but the dashboard stays empty."
          >
            <div className="grid gap-3">
              {[
                "Check that the project API key matches the project you expect.",
                "Verify the ingest endpoint is reachable from your app or service.",
                "Make sure `TraceForge.init(...)` actually runs on startup.",
                "Browser-originated ingest from another origin requires CORS. Backend-originated events avoid that browser restriction.",
                "If grouping looks wrong, send the exact same message and stack trace twice, then slightly change the message to confirm a new issue appears."
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-text-secondary">
                    {index + 1}
                  </span>
                  <p className="text-sm text-text-secondary">{item}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
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
