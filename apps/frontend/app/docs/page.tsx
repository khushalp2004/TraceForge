export default function DocsPage() {
  return (
    <main className="tf-page">
      <div className="relative mx-auto max-w-3xl">
          <header>
            <p className="tf-kicker">Docs</p>
            <h1 className="font-display mt-4 text-3xl font-semibold text-ink">
              TraceForge SDK
            </h1>
            <p className="mt-3 text-slate-600">
              Get started by installing the SDK and initializing it with your project API
              key. Use the SDK to capture exceptions and send them to TraceForge.
            </p>
          </header>

          <div className="tf-divider my-6" />

          <section className="tf-card space-y-3 p-6">
            <h2 className="text-lg font-semibold text-ink">Install</h2>
            <pre className="rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
{`npm install traceforge-js`}
            </pre>
          </section>

          <section className="tf-card space-y-3 p-6 mt-6">
            <h2 className="text-lg font-semibold text-ink">Initialize</h2>
            <pre className="rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
{`import TraceForge from "traceforge-js";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true
});`}
            </pre>
          </section>

          <section className="tf-card space-y-3 p-6 mt-6">
            <h2 className="text-lg font-semibold text-ink">Capture an Error</h2>
            <pre className="rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
{`try {
  throw new Error("Something broke");
} catch (error) {
  TraceForge.captureException(error, {
    environment: "development",
    payload: { route: "/signup" }
  });
}`}
            </pre>
          </section>

          <section className="tf-card space-y-3 p-6 mt-6">
            <h2 className="text-lg font-semibold text-ink">Auto Capture</h2>
            <p className="text-sm text-slate-600">
              When <span className="font-semibold">autoCapture</span> is enabled, the
              SDK will listen to <code>window.onerror</code> and
              <code>window.onunhandledrejection</code> automatically.
            </p>
          </section>
      </div>
    </main>
  );
}
