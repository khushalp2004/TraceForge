"use client";

import Link from "next/link";
import { useState } from "react";

const backendEnvSnippet = `TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_ENV=production
TRACEFORGE_RELEASE=api@1.0.0`;

const frontendEnvSnippet = `VITE_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
VITE_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
VITE_TRACEFORGE_ENV=production
VITE_TRACEFORGE_RELEASE=web@1.0.0`;

const backendInstallerSnippet = `import type { Express, NextFunction, Request, Response } from "express";
import TraceForge from "usetraceforge";

const normalizeError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

export const installTraceForge = (app: Express) => {
  TraceForge.init({
    apiKey: process.env.TRACEFORGE_API_KEY || "",
    endpoint: process.env.TRACEFORGE_INGEST_URL,
    autoCapture: false,
    environment: process.env.TRACEFORGE_ENV || "production",
    release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
  });

  app.use((error: unknown, req: Request, _res: Response, next: NextFunction) => {
    void TraceForge.captureException(normalizeError(error), {
      payload: {
        route: req.originalUrl,
        method: req.method
      }
    });

    next(error);
  });

  process.on("unhandledRejection", (reason) => {
    void TraceForge.captureException(normalizeError(reason), {
      payload: { source: "unhandledRejection" }
    });
  });

  process.on("uncaughtException", (error) => {
    void TraceForge.captureException(normalizeError(error), {
      payload: { source: "uncaughtException" }
    });
  });
};`;

const backendIndexSnippet = `import express from "express";
import { installTraceForge } from "./traceforge.js";

const app = express();

installTraceForge(app);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: "Internal server error" });
});`;

const frontendBrowserSnippet = `import TraceForge from "usetraceforge";

const TRACEFORGE_INGEST_URL =
  import.meta.env.VITE_TRACEFORGE_INGEST_URL || "http://localhost:3001/ingest";

const TRACEFORGE_API_KEY = import.meta.env.VITE_TRACEFORGE_API_KEY || "";
const TRACEFORGE_ENV = import.meta.env.VITE_TRACEFORGE_ENV || "local";
const TRACEFORGE_RELEASE = import.meta.env.VITE_TRACEFORGE_RELEASE || "web@1.0.0";

let traceForgeInitialized = false;

export function initTraceForgeBrowser() {
  if (traceForgeInitialized || !TRACEFORGE_API_KEY) return;

  TraceForge.init({
    apiKey: TRACEFORGE_API_KEY,
    endpoint: TRACEFORGE_INGEST_URL,
    autoCapture: true,
    environment: TRACEFORGE_ENV,
    release: TRACEFORGE_RELEASE
  });

  traceForgeInitialized = true;
}

export async function sendToTraceForge(
  error: unknown,
  extra: Record<string, unknown> = {}
) {
  const err = error instanceof Error ? error : new Error(String(error));

  await TraceForge.captureException(err, {
    environment: TRACEFORGE_ENV,
    release: TRACEFORGE_RELEASE,
    payload: {
      route: typeof extra.route === "string" ? extra.route : window.location.pathname,
      ...extra
    }
  });
}`;

const frontendStartupSnippet = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initTraceForgeBrowser } from "./traceforge";

initTraceForgeBrowser();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

const handledErrorSnippet = `try {
  const result = await searchCatalog(query);
  setResponse(result);
} catch (error) {
  void sendToTraceForge(error, {
    route: "/search",
    query,
    source: "search-page"
  });
}`;

const viteEnvSnippet = `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRACEFORGE_INGEST_URL?: string;
  readonly VITE_TRACEFORGE_API_KEY?: string;
  readonly VITE_TRACEFORGE_ENV?: string;
  readonly VITE_TRACEFORGE_RELEASE?: string;
}`;

const tsconfigSnippet = `{
  "compilerOptions": {
    "moduleResolution": "Bundler"
  }
}`;

const nodeTypesSnippet = `{
  "devDependencies": {
    "@types/node": "^20.16.5"
  }
}`;

const tsconfigNodeSnippet = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "moduleResolution": "Bundler",
    "types": ["node"],
    "skipLibCheck": true
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

export default function DocsReferencePage() {
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

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-6xl">
        <header className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="tf-kicker">Reference</p>
              <h1 className="tf-title mt-4 text-4xl sm:text-5xl">
                TraceForge configuration reference
              </h1>
              <p className="mt-4 text-base text-text-secondary">
                This page is the line-by-line blueprint for wiring `usetraceforge` into a real app.
                It is written for users who want exact file placement, exact env names, and exact
                runtime hooks without needing extra project context.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="tf-button px-6 py-3 text-sm" href="/docs">
                Back to docs
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/dashboard/projects">
                Open projects
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Example stack",
                text: "Node.js + Express + TypeScript + ESM on the backend and Vite + React + TypeScript on the frontend."
              },
              {
                title: "SDK package",
                text: "Install `usetraceforge` anywhere you want TraceForge to send runtime events."
              },
              {
                title: "Best use",
                text: "Use this page when you want a strict reference implementation rather than a short quickstart."
              }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="mt-2 text-sm text-text-secondary">{item.text}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-8 space-y-6">
          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Install
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              1. Install the SDK
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Install `usetraceforge` in every runtime that will send events. In split apps, that
              usually means the frontend package and the backend package separately.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SnippetBlock title="Backend or root install" code={`npm install usetraceforge`} onCopy={copySnippet} />
              <SnippetBlock title="Split-package install" code={`cd frontend && npm install usetraceforge\ncd ../backend && npm install usetraceforge`} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Environment Variables
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              2. Add env values before any runtime init
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Backend env values stay private. Browser env values must use the client prefix that
              your framework expects.
            </p>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <SnippetBlock title="Backend `.env`" code={backendEnvSnippet} onCopy={copySnippet} />
              <SnippetBlock title="Frontend `.env` for Vite" code={frontendEnvSnippet} onCopy={copySnippet} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
                "Use `TRACEFORGE_API_KEY` on the backend.",
                "Use `VITE_TRACEFORGE_*` in Vite browser apps.",
                "Use one project API key for the app or service you want to monitor.",
                "Set stable `environment` and `release` values before deploying."
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Backend Configuration
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              3. Create the backend TraceForge installer
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Put this in a dedicated backend helper like `src/traceforge.ts` or
              `src/traceforge/install.ts`. Its job is to initialize the SDK once, capture Express
              middleware errors, and capture `unhandledRejection` and `uncaughtException`.
            </p>
            <div className="mt-5">
              <SnippetBlock title="Backend installer pattern" code={backendInstallerSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Backend Placement
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              4. Install it on the real Express app
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Import the installer into your actual server bootstrap file and call it before the
              final 404 and final error handlers. In ESM `NodeNext`, local runtime imports should
              use the `.js` extension.
            </p>
            <div className="mt-5">
              <SnippetBlock title="`backend/src/index.ts` pattern" code={backendIndexSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Frontend Configuration
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              5. Create the browser TraceForge module
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Put this in `src/traceforge.ts`, `src/traceforge/browser.ts`, or a similar client-side
              helper. Its job is to initialize the SDK once, enable `autoCapture`, and expose a
              helper for handled frontend errors.
            </p>
            <div className="mt-5">
              <SnippetBlock title="Frontend browser pattern" code={frontendBrowserSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Frontend Startup
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              6. Initialize it during app startup
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Call the browser init before or during main app bootstrap so browser-level errors are
              captured as early as possible.
            </p>
            <div className="mt-5">
              <SnippetBlock title="`frontend/src/main.tsx` pattern" code={frontendStartupSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Handled Frontend Errors
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              7. Send handled frontend errors explicitly
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              Auto-capture handles uncaught runtime errors and unhandled promise rejections. It does
              not automatically report every error inside your own `try/catch` blocks.
            </p>
            <div className="mt-5">
              <SnippetBlock title="Handled error example" code={handledErrorSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              TypeScript Support
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              8. Add the Vite + TypeScript support files
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              If your frontend uses Vite + TypeScript, add env typings and make sure TypeScript can
              resolve browser and Node-side config cleanly.
            </p>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <SnippetBlock title="`vite-env.d.ts`" code={viteEnvSnippet} onCopy={copySnippet} />
              <SnippetBlock title="`tsconfig.json`" code={tsconfigSnippet} onCopy={copySnippet} />
              <SnippetBlock title="`package.json` devDependencies" code={nodeTypesSnippet} onCopy={copySnippet} />
              <SnippetBlock title="`tsconfig.node.json`" code={tsconfigNodeSnippet} onCopy={copySnippet} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Checklist
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              9. Validation checklist
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                "`usetraceforge` is installed in backend and frontend.",
                "Backend env values are present.",
                "Frontend env values are present.",
                "Backend calls `installTraceForge(app)`.",
                "Frontend calls `initTraceForgeBrowser()`.",
                "Handled frontend errors call `sendToTraceForge(...)`.",
                "Backend middleware is installed before the final error handler.",
                "Unhandled browser and backend failures both show up in TraceForge."
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Common Mistakes
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              10. Things that commonly break configuration
            </h2>
            <div className="mt-5 grid gap-3">
              {[
                "Adding env variables but never calling `TraceForge.init(...)`.",
                "Installing backend capture after the final error handler.",
                "Forgetting to report handled errors inside `catch` blocks.",
                "Using non-`VITE_` env names in a Vite frontend.",
                "Assuming browser auto-capture also covers handled errors.",
                "Using a local runtime import without `.js` in an ESM `NodeNext` backend."
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

          <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Verification
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">
              11. Run and verify
            </h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <SnippetBlock title="Backend verify" code={`cd backend\nnpm run build\nnpm run dev`} onCopy={copySnippet} />
              <SnippetBlock title="Frontend verify" code={`cd frontend\nnpm run build\nnpm run dev`} onCopy={copySnippet} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                "Backend runtime crash route or controlled 500",
                "Backend malformed search or validation error",
                "Frontend handled error from a search or request flow",
                "Frontend unhandled rejection from a test action"
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </section>
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
