"use client";

import { useState } from "react";
import Link from "next/link";

const installSnippet = `npm install usetraceforge`;

const installFrontendSnippet = `cd frontend
npm install usetraceforge`;

const installBackendSnippet = `cd backend
npm install usetraceforge`;

const publishSnippet = `cd packages/sdk
npm login
npm run build
npm version patch
npm publish --access public

# after publish
npm install usetraceforge`;

const configurationSnippet = `Backend is configured when:
- TraceForge middleware is installed before the final Express error handler
- API key, environment, and release values are read from env
- The backend helper sends X-Traceforge-Key and forwards errors with context

Frontend is configured when:
- ingest URL, API key, environment, and release are available from env
- browser auto-capture is enabled for window.error and unhandledrejection
- a manual helper exists for handled exceptions and failed requests

Build support is configured when:
- env typing files are present for the frontend toolchain
- required dependencies are installed
- TypeScript/build settings allow env-based imports to compile cleanly`;

const initSnippet = `import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true,
  environment: "production",
  release: "web@1.0.0"
});`;

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

app.use((error, _req, res, _next) => {
  TraceForge.captureException(error, {
    payload: { route: "express-error-handler" }
  }).catch(() => undefined);

  res.status(500).json({ error: "Internal server error" });
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
    {
      payload: extra
    }
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
  await TraceForge.captureException(err, {
    payload: extra
  });
}`;

const backendJavaScriptSnippet = `import express from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});

const app = express();

app.use((error, req, _res, next) => {
  TraceForge.captureException(
    error instanceof Error ? error : new Error(String(error)),
    {
      payload: {
        route: req.originalUrl,
        method: req.method
      }
    }
  ).catch(() => undefined);

  next(error);
});`;

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
    payload: {
      route: req.originalUrl,
      method: req.method
    }
  });

  next(error);
});`;

const verifySnippet = `try {
  throw new Error("TraceForge setup test");
} catch (error) {
  TraceForge.captureException(error, {
    payload: {
      route: "/setup-check",
      source: "manual-test"
    }
  });
}`;

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
X-Traceforge-Key: <PROJECT_API_KEY>
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

const envSnippet = `TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_PROJECT_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_ENV=local
TRACEFORGE_RELEASE=web@1.0.0`;

const helperSnippet = `const TRACEFORGE_INGEST_URL =
  process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL ||
  process.env.TRACEFORGE_INGEST_URL ||
  "http://localhost:3001/ingest";

const TRACEFORGE_API_KEY =
  process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY ||
  process.env.TRACEFORGE_API_KEY;

const TRACEFORGE_ENV =
  process.env.NEXT_PUBLIC_TRACEFORGE_ENV ||
  process.env.TRACEFORGE_ENV ||
  "local";

const TRACEFORGE_RELEASE =
  process.env.NEXT_PUBLIC_TRACEFORGE_RELEASE ||
  process.env.TRACEFORGE_RELEASE ||
  "web@1.0.0";

export async function sendToTraceForge(error, extra = {}) {
  const err = error instanceof Error ? error : new Error(String(error));

  await fetch(TRACEFORGE_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Traceforge-Key": TRACEFORGE_API_KEY
    },
    body: JSON.stringify({
      message: err.message,
      stackTrace: err.stack || "",
      environment: TRACEFORGE_ENV,
      release: TRACEFORGE_RELEASE,
      payload: {
        route: extra.route || "/demo",
        ...extra
      }
    })
  });
}`;

const sidebarSections = [
  "Quickstart",
  "Step-by-step setup",
  "Choose your stack",
  "JS and TS examples",
  "Configuration",
  "Publishing",
  "Frontend setup",
  "Backend setup",
  "SDK setup",
  "Testing integrations",
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
    await copySnippet(
      [
        installSnippet,
        installFrontendSnippet,
        installBackendSnippet,
        configurationSnippet,
        publishSnippet,
        initSnippet,
        nextEnvSnippet,
        nextSetupSnippet,
        frontendJavaScriptSnippet,
        frontendTypeScriptSnippet,
        backendJavaScriptSnippet,
        backendTypeScriptSnippet,
        frontendEnvSnippet,
        frontendSetupSnippet,
        backendEnvSnippet,
        backendSetupSnippet,
        envSnippet,
        helperSnippet,
        captureSnippet,
        ingestSnippet
      ].join("\n\n")
    );
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
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/docs/reference">
                Open reference
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
                "Install and initialize `usetraceforge`",
                "Publish the npm package cleanly",
                "Set up frontend and backend entrypoints",
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
                <p>Wire a shared helper into any app</p>
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

            <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">Need the full blueprint?</p>
              <p className="mt-2 text-sm text-text-secondary">
                Open the reference page for exact file names, exact env blocks, backend middleware order,
                and a complete Express + Vite integration pattern.
              </p>
              <Link className="tf-link mt-3 inline-flex" href="/docs/reference">
                Open reference →
              </Link>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Choose your stack
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                    Put the code in the right files even without project-specific context
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Self-serve mapping
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                Most users get stuck because docs say what code to use but not exactly where it should live.
                Use the mapping below. If a file does not exist in your app, create it. What matters is the
                startup file, the shared TraceForge helper, and the final backend error path.
              </p>

              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                {[
                  {
                    title: "Vite + React",
                    items: [
                      "Create `src/traceforge/browser.ts` or `browser.js`",
                      "Call it from `src/main.tsx`, `src/main.jsx`, or equivalent entry file",
                      "Use `VITE_TRACEFORGE_*` env variables in `.env`"
                    ]
                  },
                  {
                    title: "Next.js App Router",
                    items: [
                      "Create `app/components/TraceForgeInit.tsx`",
                      "Render it once inside `app/layout.tsx`",
                      "Use `NEXT_PUBLIC_TRACEFORGE_*` env variables in `.env.local`"
                    ]
                  },
                  {
                    title: "Node.js + Express",
                    items: [
                      "Create `src/traceforge/install.ts` or `install.js`",
                      "Call it from `src/index.ts`, `src/server.ts`, or your main server file",
                      "Install it before the final Express error handler"
                    ]
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <div className="mt-3 space-y-2 text-sm text-text-secondary">
                      {item.items.map((entry) => (
                        <p key={entry}>{entry}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-primary/15 bg-accent-soft p-4">
                <p className="text-sm font-semibold text-text-primary">No-AI rule of thumb</p>
                <p className="mt-2 text-sm text-text-secondary">
                  If you can identify your app entry file and your backend error handler, you can wire
                  TraceForge without AI. The docs now map each supported stack to the exact files you need to create or edit.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    JS and TS examples
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                    Use the same setup in JavaScript or TypeScript
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Language-specific
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                The setup steps above stay the same for both languages. The only real difference is
                typing around env values, helper functions, and Express middleware signatures. Use
                the version below that matches your app.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  {
                    title: "Frontend JavaScript",
                    text: "Best for plain React or Vite JavaScript apps that just need a simple startup init and helper."
                  },
                  {
                    title: "Frontend TypeScript",
                    text: "Best when you want typed helper parameters and stricter error handling in browser code."
                  },
                  {
                    title: "Backend JavaScript",
                    text: "Best for Express apps using plain Node.js JavaScript and standard `process.env` values."
                  },
                  {
                    title: "Backend TypeScript",
                    text: "Best for typed Express handlers, explicit middleware signatures, and TS-first server code."
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Frontend JavaScript" code={frontendJavaScriptSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Frontend TypeScript" code={frontendTypeScriptSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend JavaScript" code={backendJavaScriptSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend TypeScript" code={backendTypeScriptSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-secondary/15 p-4">
                <p className="text-sm font-semibold text-text-primary">When to use which version</p>
                <p className="mt-2 text-sm text-text-secondary">
                  If your app is already JavaScript, you do not need to convert anything to TypeScript
                  just to use TraceForge. If your app is TypeScript, prefer the typed examples so your
                  env access, helper utilities, and error middleware stay consistent with the rest of your codebase.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Step-by-step setup
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                    Configure TraceForge in a new app without guessing
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Beginner flow
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                If you are new, use this order: create a project, copy the API key, install the SDK,
                add env values, initialize the SDK on startup, then trigger one test error. Frontend-only
                apps need only the frontend steps, backend-only apps need only the backend steps, and
                full-stack apps should do both.
              </p>

              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                {[
                  {
                    title: "Frontend-only app",
                    text: "Do Step 1, then frontend install, frontend env, frontend init, and the verification step."
                  },
                  {
                    title: "Backend-only app",
                    text: "Do Step 1, then backend install, backend env, backend init, and verify through a server-side error."
                  },
                  {
                    title: "Full-stack app",
                    text: "Use one project API key, install the SDK in both apps, and configure frontend plus backend separately."
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {[
                  {
                    step: "01",
                    title: "Create a project in TraceForge",
                    text: "Open the dashboard, create a project, and copy the project API key. That same key is what the SDK uses to send events.",
                    extra: "Dashboard → Projects → Create project → Copy API key"
                  },
                  {
                    step: "02",
                    title: "Install the SDK in the app you want to monitor",
                    text: "Install `usetraceforge` in the frontend app, the backend app, or both depending on your architecture.",
                    extra: "Use the frontend folder for browser apps and the backend folder for server apps."
                  },
                  {
                    step: "03",
                    title: "Add environment variables",
                    text: "Put the ingest URL, project API key, environment, and release into env files before initializing the SDK.",
                    extra: "Frontend apps usually use `VITE_` or `NEXT_PUBLIC_` variables. Backend apps use server env variables."
                  },
                  {
                    step: "04",
                    title: "Initialize TraceForge at startup",
                    text: "Call `TraceForge.init(...)` one time when the app boots. Without this, installing the package alone does nothing.",
                    extra: "Frontend: app entrypoint. Backend: process startup or shared bootstrap."
                  },
                  {
                    step: "05",
                    title: "Capture handled errors where needed",
                    text: "Auto-capture only covers uncaught browser errors and unhandled promise rejections. Caught errors still need `captureException(...)`.",
                    extra: "Backend apps should also report from Express error middleware and process-level handlers."
                  },
                  {
                    step: "06",
                    title: "Trigger one test error and verify the dashboard",
                    text: "Send one controlled error after setup. Then open Issues in TraceForge and confirm the event appears under the correct project.",
                    extra: "If nothing appears, first re-check API key, ingest URL, env values, and whether `TraceForge.init(...)` actually runs."
                  }
                ].map((item) => (
                  <div key={item.step} className="rounded-2xl border border-border bg-secondary/15 p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-accent-soft text-sm font-semibold text-primary">
                        {item.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-text-primary">{item.title}</p>
                        <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                        <p className="mt-2 text-sm text-text-secondary">{item.extra}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Install in frontend" code={installFrontendSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Install in backend" code={installBackendSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Frontend env example" code={frontendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend env example" code={backendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Frontend init" code={frontendSetupSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend init" code={backendSetupSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-6 rounded-2xl border border-primary/15 bg-accent-soft p-4">
                <p className="text-sm font-semibold text-text-primary">Most important warning</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Adding env values is not enough. A project is only configured after your app actually
                  runs `TraceForge.init(...)`. On the backend, middleware order also matters: install
                  TraceForge before the final Express error handler.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Publishing
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Ship the SDK as `usetraceforge`
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  npm workflow
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                The SDK-first path gives you the most reliable integration story. Publish the package,
                install it with `npm install usetraceforge`, and keep the runtime wiring under the app's own control.
              </p>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Publish workflow" code={publishSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend env example" code={envSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Package name",
                    text: "Keep the SDK package published as `usetraceforge` so install instructions stay simple and aligned with the product brand."
                  },
                  {
                    title: "Release flow",
                    text: "Build, bump the package version, publish, then install from npm in target apps instead of relying on repo-specific scaffolding."
                  },
                  {
                    title: "Local fallback",
                    text: "Use `npm pack` and install the generated tarball locally while you test before the public publish step."
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Frontend setup
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Configure browser apps at startup
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  React, Vite, Next.js
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                Install the SDK, keep the API key and release data in frontend-safe env values,
                and initialize TraceForge in your app entrypoint so uncaught browser errors and
                promise rejections are captured automatically.
              </p>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Vite env example" code={frontendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Vite init" code={frontendSetupSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Next.js env example" code={nextEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Next.js init component" code={nextSetupSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Where to initialize",
                    text: "Run `TraceForge.init(...)` once in the main browser entrypoint or root layout bootstrap."
                  },
                  {
                    title: "What auto-capture covers",
                    text: "Use `autoCapture: true` to record uncaught runtime errors and unhandled promise rejections."
                  },
                  {
                    title: "Handled errors too",
                    text: "Call `TraceForge.captureException(...)` anywhere you catch an error but still want it visible in TraceForge."
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-secondary/15 p-4">
                <p className="text-sm font-semibold text-text-primary">Typical frontend file placement</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Keep a small file like `src/traceforge/browser.ts`, initialize it from `src/main.tsx`
                  or your root layout bootstrap, and reuse `TraceForge.captureException(...)` in places
                  like search, checkout, auth, and failed requests. In Next.js App Router, the same role
                  is usually handled by a small client component rendered from `app/layout.tsx`.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Backend setup
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Configure server-side capture cleanly
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Node.js, Express
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                Initialize the SDK during backend startup, keep configuration in env, and call
                `captureException(...)` from your server error path so real 500-class failures are
                forwarded with release and environment context.
              </p>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title="Backend env example" code={backendEnvSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Backend init" code={backendSetupSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Initialize early",
                    text: "Call `TraceForge.init(...)` during process startup so every route and service can reuse the same configuration."
                  },
                  {
                    title: "Capture before response ends",
                    text: "Report exceptions from your central error middleware before returning the final 500 response."
                  },
                  {
                    title: "Tag deploy context",
                    text: "Set `TRACEFORGE_RELEASE` and `TRACEFORGE_ENV` on every deployment so issues stay easy to triage later."
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-secondary/15 p-4">
                <p className="text-sm font-semibold text-text-primary">Typical backend file placement</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Many teams keep `TraceForge.init(...)` in `src/traceforge/install.ts` or a bootstrap file,
                  call it from `src/index.ts`, and report errors from Express middleware plus `unhandledRejection`
                  and `uncaughtException` handlers.
                </p>
              </div>
            </section>

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
                    Configuration
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    What fully configured looks like
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Operational checklist
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                A project is truly configured only when the runtime wiring, environment values, and
                build support are all aligned. Patching files is only the first step.
              </p>

              <div className="mt-5">
                <SnippetBlock title="Configuration checklist" code={configurationSnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Backend wiring",
                    text: "Install middleware before the final error handler so real route and runtime errors pass through TraceForge capture."
                  },
                  {
                    title: "Frontend capture",
                    text: "Use env-driven config, automatic browser capture, and a manual helper for handled exceptions or failed requests."
                  },
                  {
                    title: "Build support",
                    text: "Keep env typings, required dependencies, and toolchain settings in place so the generated integration actually compiles."
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Testing integrations
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Verify TraceForge in any app stack
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-text-secondary">
                  SDK or direct ingest
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                Use these patterns to test TraceForge in any project, whether you are wiring it
                into a browser app, a backend service, or a small integration sandbox before a
                broader rollout.
              </p>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <SnippetBlock title=".env example" code={envSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Shared helper" code={helperSnippet} onCopy={copySnippet} />
                <SnippetBlock title="Manual verification" code={verifySnippet} onCopy={copySnippet} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  {
                    title: "Client-side verification",
                    text: "Trigger a repeated error, a slightly different error, a promise rejection, and a failed request so you can confirm grouping and issue creation."
                  },
                  {
                    title: "Server-side verification",
                    text: "Test a few controlled failures such as 500s, timeouts, validation errors, auth failures, repeated grouped errors, and unique errors."
                  },
                  {
                    title: "Most reliable local path",
                    text: "Server-originated test events are usually the easiest local ingestion check because they avoid browser cross-origin restrictions."
                  },
                  {
                    title: "Setup handshake check",
                    text: "If a project says Waiting for setup handshake, restart the target app and verify the SDK init path actually runs with the intended API key, release, and environment."
                  },
                  {
                    title: "Shared helper pattern",
                    text: "Keep one small helper per app or service so message, stack trace, environment, release, and route metadata stay consistent."
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
                    Best practice: send the same release tag on every event and include it in the payload if you are using direct ingest or a lightweight helper.
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
                  "Avoid local port conflicts by running your integration test app on a different port than the TraceForge frontend if needed.",
                  "Verify the ingest endpoint is reachable from your app or service.",
                  "Browser-side ingest from another origin requires CORS to allow the request. Backend-originated events bypass that browser restriction.",
                  "If a project is stuck on Waiting for setup handshake, verify that your SDK init path runs on startup and that setup or first-event requests are not blocked by env or network issues.",
                  "Use the exact same error message and stack trace to verify grouping. Change the message slightly to verify a new issue is created.",
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
