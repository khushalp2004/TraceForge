export default function DocsPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-6xl">
        <header className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="tf-kicker">Docs</p>
            <h1 className="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl lg:text-5xl">
              TraceForge SDK Quickstart
            </h1>
            <p className="mt-3 text-text-secondary">
              Copy-paste setup for the SDK, then verify ingestion and start grouping stack
              traces in minutes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="tf-button px-5 py-2 text-sm" href="/dashboard">
                Start trial
              </a>
              <a className="tf-button-ghost px-5 py-2 text-sm" href="/docs">
                API reference
              </a>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-secondary">
              {["Node.js", "Next.js", "Python", "Go", "Docker"].map((sdk) => (
                <span key={sdk} className="tf-chip">
                  {sdk}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary">What you’ll ship today</p>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              <li>• Install the SDK and send your first exception</li>
              <li>• Verify grouping and environment tags</li>
              <li>• Enable auto-capture and deploy</li>
            </ul>
          </div>
        </header>

        <div className="tf-divider my-8" />

        <section className="grid gap-8 lg:grid-cols-[0.25fr_0.75fr]">
          <aside className="order-2 space-y-4 lg:order-1">
            <div className="rounded-2xl border border-border bg-card/90 p-4">
              <p className="text-xs font-semibold text-text-secondary">Quickstart</p>
              <div className="mt-3 space-y-2 text-sm">
                {["Install", "Initialize", "Capture", "Verify"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between text-text-secondary">
                    <span>Step {index + 1}</span>
                    <span className="font-semibold text-text-primary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/90 p-4">
              <p className="text-xs font-semibold text-text-secondary">Popular topics</p>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                <li>• Source maps</li>
                <li>• Release tracking</li>
                <li>• Environments &amp; tags</li>
                <li>• Sampling</li>
                <li>• Webhooks</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card/90 p-4">
              <p className="text-xs font-semibold text-text-secondary">Need help?</p>
              <p className="mt-2 text-sm text-text-secondary">
                Get a guided setup or ask questions in the team docs.
              </p>
              <a className="tf-link mt-3 inline-flex" href="/docs">
                Open support docs →
              </a>
            </div>
          </aside>

          <div className="order-1 space-y-6 min-w-0 lg:order-2">
            <section className="tf-card space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary/70 px-2 py-0.5">Step 1</span>
                  Install the SDK
                </div>
                <button className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  Copy
                </button>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Install</h2>
              <pre className="w-full max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink p-4 text-sm text-white/90">
{`npm install traceforge-js`}
              </pre>
            </section>

            <section className="tf-card space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary/70 px-2 py-0.5">Step 2</span>
                  Connect your project
                </div>
                <button className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  Copy
                </button>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Initialize</h2>
              <pre className="w-full max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink p-4 text-sm text-white/90">
{`import TraceForge from "traceforge-js";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true
});`}
              </pre>
            </section>

            <section className="tf-card space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary/70 px-2 py-0.5">Step 3</span>
                  Capture an error
                </div>
                <button className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  Copy
                </button>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Capture an Error</h2>
              <pre className="w-full max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink p-4 text-sm text-white/90">
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
            <section className="tf-card space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary/70 px-2 py-0.5">Step 4</span>
                  Verify ingestion
                </div>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Verify</h2>
              <p className="text-sm text-text-secondary">
                Trigger a test exception and confirm it appears in TraceForge within seconds.
                Use environment tags to validate release grouping.
              </p>
              <div className="rounded-xl border border-primary/15 bg-accent-soft px-4 py-3 text-xs text-text-primary">
                Tip: Add <span className="font-mono">release</span> and <span className="font-mono">environment</span>{" "}
                tags to speed up triage.
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
