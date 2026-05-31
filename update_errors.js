const fs = require('fs');
const path = './apps/frontend/app/dashboard/errors/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace main layout and back button
content = content.replace(
  /<main className="tf-page tf-dashboard-page">\s*<div className="tf-dashboard">\s*<Link className="tf-link" href="\/dashboard\/issues">\s*← Back to issues\s*<\/Link>/g,
  `<main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <Link
          href="/dashboard/issues"
          className="group mb-8 inline-flex items-center gap-2 text-[15px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Issues
        </Link>`
);

// Remove the closing div for tf-dashboard since we removed it in the opening
content = content.replace(
  /<\/div>\s*<\/main>/g,
  `</main>`
);

// 2. Replace header
content = content.replace(
  /<header className="mt-4 overflow-hidden rounded-3xl border border-border bg-card\/95 p-6 shadow-sm">[\s\S]*?(<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">)/,
  `<header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
              {errorDetail.project.name}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl break-words">
                {errorDetail.message}
              </h1>
              <PageDescriptionPopover>
                {errorDetail.isManualAlertIssue
                  ? "Review the grouped stack and recent event payloads for this manually triggered alert issue without losing the higher-level inbox context."
                  : "Review the grouped stack, recent event payloads, and AI guidance for this issue without losing the higher-level inbox context."}
              </PageDescriptionPopover>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
            {aiStatus && (
              <span className="w-full text-[13px] font-medium text-text-secondary lg:w-auto">{aiStatus}</span>
            )}
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-5 text-[13px] font-semibold text-text-primary shadow-sm backdrop-blur-md transition-all hover:bg-secondary/60 hover:shadow max-[639px]:w-full sm:w-auto"
              onClick={handleCopyStack}
            >
              <Copy className="h-4 w-4" />
              {copyStatus ?? "Copy stack"}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-5 text-[13px] font-semibold text-text-primary shadow-sm backdrop-blur-md transition-all hover:bg-secondary/60 hover:shadow max-[639px]:w-full sm:w-auto"
              onClick={openGithubModal}
            >
              <Github className="h-4 w-4" />
              GitHub issue
            </button>
            {!errorDetail.isManualAlertIssue && (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-70 max-[639px]:w-full sm:w-auto"
                onClick={handleRegenerate}
                disabled={regenerating || isAiWorkInFlight(errorDetail)}
              >
                <LoadingButtonContent
                  loading={regenerating}
                  loadingLabel="Generating..."
                  idleLabel="Generate AI"
                  icon={Sparkles}
                />
              </button>
            )}
          </div>
        </header>

        $1`
);

// 3. Replace the 4 stat blocks grid
content = content.replace(
  /<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">[\s\S]*?<\/header>/,
  `<div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                First seen
              </p>
              <p className="mt-2 text-[15px] font-semibold text-text-primary">
                {new Date(errorDetail.firstSeen).toLocaleString()}
              </p>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Last seen
              </p>
              <p className="mt-2 text-[15px] font-semibold text-text-primary">
                {new Date(errorDetail.lastSeen).toLocaleString()}
              </p>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Occurrences
              </p>
              <p className="mt-2 text-[15px] font-semibold text-text-primary">
                {errorDetail.count} hits
              </p>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Event payloads
              </p>
              <p className="mt-2 text-[15px] font-semibold text-text-primary">
                {payloadEventCount} with context
              </p>
            </div>
          </div>`
);

// 4. Replace section wrappers
content = content.replace(
  /<section className="mt-6 grid gap-6 xl:grid-cols-\[minmax\(0,1.2fr\)_380px\]">/g,
  `<section className="mb-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">`
);

// Replace Stack Trace section
content = content.replace(
  /<section className="overflow-hidden rounded-3xl border border-border bg-card\/95 p-6 shadow-sm">[\s\S]*?<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">[\s\S]*?<div className="min-w-0">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-text-secondary">\s*Stack trace\s*<\/p>[\s\S]*?<h2 className="mt-2 text-xl font-semibold text-text-primary">\s*Grouped frames and source locations\s*<\/h2>[\s\S]*?<\/div>[\s\S]*?<button[\s\S]*?onClick=\{\(\) => setShowAllFrames\(\(prev\) => !prev\)\}[\s\S]*?>[\s\S]*?\{showAllFrames \? "Collapse frames" : "Show all frames"\}[\s\S]*?<\/button>[\s\S]*?<\/div>[\s\S]*?<div className="mt-5 space-y-3">[\s\S]*?\{visibleFrames.map\(\(frame, index\) => \([\s\S]*?<div[\s\S]*?key=\{`\$\{frame.raw\}-\$\{index\}`\}[\s\S]*?className="min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary\/20 px-4 py-4"[\s\S]*?>[\s\S]*?<div className="overflow-x-auto">[\s\S]*?<p className="min-w-0 break-all text-sm font-medium text-text-primary">\{frame.raw\}<\/p>[\s\S]*?<\/div>[\s\S]*?\{frame.file && \([\s\S]*?<p className="mt-2 break-all text-xs text-text-secondary">[\s\S]*?\{frame.file\}:\{frame.line\}:\{frame.column\}[\s\S]*?<\/p>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?\)\)}[\s\S]*?\{\!showAllFrames && frames.length > visibleFrames.length && \([\s\S]*?<p className="text-sm text-text-secondary">[\s\S]*?Showing \{visibleFrames.length\} of \{frames.length\} frames.[\s\S]*?<\/p>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<\/section>/,
  `<section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Stack Trace
              </h2>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border/40 bg-secondary/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-text-primary">
                      Grouped frames and source locations
                    </p>
                  </div>
                  <button
                    className="rounded-full bg-secondary/50 px-4 py-2 text-[13px] font-medium text-text-primary transition-colors hover:bg-secondary/80"
                    onClick={() => setShowAllFrames((prev) => !prev)}
                  >
                    {showAllFrames ? "Collapse frames" : "Show all frames"}
                  </button>
                </div>

                <div className="flex flex-col">
                  {visibleFrames.map((frame, index) => (
                    <div
                      key={\`\${frame.raw}-\${index}\`}
                      className="border-b border-border/40 p-4 last:border-0 hover:bg-secondary/10 transition-colors"
                    >
                      <div className="overflow-x-auto">
                        <p className="min-w-0 break-all text-[14px] font-medium text-text-primary">{frame.raw}</p>
                      </div>
                      {frame.file && (
                        <p className="mt-1.5 break-all text-[12px] text-text-secondary">
                          {frame.file}:{frame.line}:{frame.column}
                        </p>
                      )}
                    </div>
                  ))}
                  {!showAllFrames && frames.length > visibleFrames.length && (
                    <div className="p-4 text-center text-[13px] text-text-secondary bg-secondary/5">
                      Showing {visibleFrames.length} of {frames.length} frames.
                    </div>
                  )}
                </div>
              </div>
            </section>`
);

// Replace Events section
content = content.replace(
  /<section className="overflow-hidden rounded-3xl border border-border bg-card\/95 p-6 shadow-sm">[\s\S]*?<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">[\s\S]*?<div className="min-w-0">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-text-secondary">\s*Recent events\s*<\/p>[\s\S]*?<h2 className="mt-2 text-xl font-semibold text-text-primary">\s*Payloads and environment snapshots\s*<\/h2>[\s\S]*?<\/div>[\s\S]*?<span className="w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">[\s\S]*?\{filteredEvents.length\} events[\s\S]*?<\/span>[\s\S]*?<\/div>[\s\S]*?<div className="tf-filter-panel mt-5">[\s\S]*?<div className="tf-filter-header">[\s\S]*?<div>[\s\S]*?<p className="text-sm font-semibold text-text-primary">Event filters<\/p>[\s\S]*?<p className="tf-filter-help">[\s\S]*?Search payload content or reveal the full payload JSON when you need deeper context.[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div className="tf-filter-grid md:grid-cols-\[minmax\(0,1fr\)_200px\]">[\s\S]*?<label className="tf-filter-field">[\s\S]*?<span className="tf-filter-label">Payload search<\/span>[\s\S]*?<input[\s\S]*?className="tf-input tf-filter-control min-w-0"[\s\S]*?placeholder="Search payloads"[\s\S]*?value=\{payloadSearch\}[\s\S]*?onChange=\{\(event\) => setPayloadSearch\(event.target.value\)\}[\s\S]*?\/>[\s\S]*?<\/label>[\s\S]*?<label className="tf-filter-field">[\s\S]*?<span className="tf-filter-label">Visibility<\/span>[\s\S]*?<button[\s\S]*?type="button"[\s\S]*?className=\{`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition \$\{[\s\S]*?showPayloads[\s\S]*?\? "border-primary\/30 bg-primary\/12 text-primary"[\s\S]*?: "border-border bg-card text-text-secondary hover:bg-secondary\/70 hover:text-text-primary"[\s\S]*?\}`\}[\s\S]*?onClick=\{\(\) => setShowPayloads\(\(current\) => \!current\)\}[\s\S]*?>[\s\S]*?\{showPayloads \? "Hide payloads" : "Show payloads"\}[\s\S]*?<\/button>[\s\S]*?<\/label>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div className="mt-5 space-y-3">[\s\S]*?\{filteredEvents.map\(\(event\) => \([\s\S]*?<div[\s\S]*?key=\{event.id\}[\s\S]*?className="min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary\/15 px-4 py-4"[\s\S]*?>[\s\S]*?<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">[\s\S]*?<p className="break-words text-sm font-semibold text-text-primary">[\s\S]*?\{new Date\(event.timestamp\).toLocaleString\(\)\}[\s\S]*?<\/p>[\s\S]*?<span className="w-fit rounded-full border border-border bg-card px-2\.5 py-1 text-xs font-semibold text-text-secondary">[\s\S]*?\{event.environment \?\? "unknown"\}[\s\S]*?<\/span>[\s\S]*?<\/div>[\s\S]*?\{showPayloads && event.payload && \([\s\S]*?<pre className="mt-3 max-w-full overflow-x-auto rounded-2xl bg-slate-900 p-4 text-\[11px\] text-slate-100">[\s\S]*?\{JSON.stringify\(event.payload, null, 2\)\}[\s\S]*?<\/pre>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?\)\)}[\s\S]*?\{\!filteredEvents.length && \([\s\S]*?<div className="rounded-2xl border border-dashed border-border bg-secondary\/20 px-4 py-4">[\s\S]*?<p className="text-sm font-semibold text-text-primary">No matching events<\/p>[\s\S]*?<p className="mt-1 text-sm text-text-secondary">[\s\S]*?Try a broader payload search or clear the filter to see recent events again.[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<\/section>/,
  `<section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                  Recent Events
                </h2>
                <span className="rounded-full bg-secondary/50 px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                  {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-sm">
                
                <div className="flex flex-col gap-3 border-b border-border/40 bg-secondary/15 p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <input
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/60"
                      placeholder="Search payloads..."
                      value={payloadSearch}
                      onChange={(event) => setPayloadSearch(event.target.value)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center pl-12 sm:pl-0">
                    <button
                      type="button"
                      className={\`inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-medium transition-colors \${
                        showPayloads
                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                          : "bg-secondary/50 text-text-primary hover:bg-secondary/80"
                      }\`}
                      onClick={() => setShowPayloads((current) => !current)}
                    >
                      {showPayloads ? "Hide payloads" : "Show payloads"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border-b border-border/40 p-4 last:border-0 hover:bg-secondary/5 transition-colors"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <p className="break-words text-[14px] font-medium text-text-primary">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                        <span className="w-fit rounded-full bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                          {event.environment ?? "unknown"}
                        </span>
                      </div>
                      {showPayloads && event.payload && (
                        <pre className="mt-4 max-w-full overflow-x-auto rounded-[16px] bg-[#0d1117] border border-white/10 p-4 text-[12px] font-mono text-slate-300">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {!filteredEvents.length && (
                    <div className="p-6 text-center text-[15px] text-text-secondary bg-secondary/5">
                      No matching events found. Try a broader search.
                    </div>
                  )}
                </div>
              </div>
            </section>`
);

// Replace AI solution section
content = content.replace(
  /<section className="overflow-hidden rounded-3xl border border-border bg-card\/95 p-6 shadow-sm">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-text-secondary">\s*AI solution\s*<\/p>[\s\S]*?<h2 className="mt-2 text-xl font-semibold text-text-primary">\s*Suggested solution and debugging direction\s*<\/h2>[\s\S]*?\{errorDetail.isManualAlertIssue \? \([\s\S]*?<div className="mt-4 rounded-2xl border border-border bg-secondary\/20 px-4 py-4">[\s\S]*?<p className="text-sm font-semibold text-text-primary">\s*AI solution is unavailable\s*<\/p>[\s\S]*?<p className="mt-1 text-sm text-text-secondary">\s*Manual alert issues are created intentionally, so AI generation is hidden for\s*these records.\s*<\/p>[\s\S]*?<\/div>[\s\S]*?\) : hasAiResult\(errorDetail\) && aiAnalysis \? \([\s\S]*?<\/>[\s\S]*?<div className="mt-4 grid gap-4">[\s\S]*?<div className="rounded-2xl border border-border bg-secondary\/20 px-4 py-4">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-text-secondary">\s*Summary\s*<\/p>[\s\S]*?<p className="mt-2 break-words text-sm leading-7 text-text-secondary">[\s\S]*?\{getAiSummary\(errorDetail\)\}[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?\{getAiDetail\(errorDetail\) && \([\s\S]*?<div className="rounded-2xl border border-primary\/20 bg-accent-soft px-4 py-4">[\s\S]*?<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">[\s\S]*?<div className="min-w-0">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-primary">\s*Detailed solution\s*<\/p>[\s\S]*?<p className="mt-1 text-sm text-text-secondary">\s*Open the full AI reasoning only when you need deeper debugging help.\s*<\/p>[\s\S]*?<\/div>[\s\S]*?<button[\s\S]*?type="button"[\s\S]*?className="rounded-full border border-primary\/20 bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary\/35 hover:bg-card\/80 max-\[639px\]:w-full"[\s\S]*?onClick=\{\(\) => setShowAiDetail\(true\)\}[\s\S]*?>\s*View in detail\s*<\/button>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<\/>[\s\S]*?\) : \([\s\S]*?<div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary\/20 px-4 py-4">[\s\S]*?<p className="text-sm font-semibold text-text-primary">[\s\S]*?\{hasAiRequest\(errorDetail\) \? "AI solution queued" : "AI solution not generated"\}[\s\S]*?<\/p>[\s\S]*?<p className="mt-1 text-sm text-text-secondary">[\s\S]*?\{hasAiRequest\(errorDetail\)[\s\S]*?\? getQueueStatusMessage\(errorDetail\)[\s\S]*?: "Generate an AI solution when you want a fresh explanation and suggested fix for this grouped issue."\}[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?\{errorDetail.aiStatus === "FAILED" && hasAiRequest\(errorDetail\) && errorDetail.aiLastError && \([\s\S]*?<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-red-700">\s*AI generation failed\s*<\/p>[\s\S]*?<p className="mt-2 text-sm text-red-700">\{errorDetail.aiLastError\}<\/p>[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?<\/section>/,
  `<section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                AI Analysis
              </h2>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-5 shadow-sm">
                <h3 className="text-[15px] font-medium text-text-primary mb-4">Suggested solution and direction</h3>
                {errorDetail.isManualAlertIssue ? (
                  <div className="rounded-[16px] border border-border/40 bg-secondary/10 p-4">
                    <p className="text-[14px] font-medium text-text-primary">AI solution is unavailable</p>
                    <p className="mt-1 text-[13px] text-text-secondary">
                      Manual alert issues are created intentionally, so AI generation is hidden.
                    </p>
                  </div>
                ) : hasAiResult(errorDetail) && aiAnalysis ? (
                  <div className="space-y-4">
                    <div className="rounded-[16px] border border-border/40 bg-secondary/10 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary mb-2">Summary</p>
                      <p className="break-words text-[14px] leading-relaxed text-text-secondary">
                        {getAiSummary(errorDetail)}
                      </p>
                    </div>
                    {getAiDetail(errorDetail) && (
                      <div className="rounded-[16px] border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary mb-1">Detailed solution</p>
                          <p className="text-[13px] text-text-secondary">
                            Open the full AI reasoning for deeper debugging help.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full bg-card border border-primary/20 px-4 py-2 text-[13px] font-medium text-primary shadow-sm hover:bg-primary/10 transition-colors"
                          onClick={() => setShowAiDetail(true)}
                        >
                          View in detail
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-dashed border-border/60 bg-secondary/5 p-4">
                    <p className="text-[14px] font-medium text-text-primary">
                      {hasAiRequest(errorDetail) ? "AI solution queued" : "AI solution not generated"}
                    </p>
                    <p className="mt-1 text-[13px] text-text-secondary">
                      {hasAiRequest(errorDetail)
                        ? getQueueStatusMessage(errorDetail)
                        : "Generate an AI solution to get a fresh explanation and suggested fix."}
                    </p>
                  </div>
                )}
                {errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail) && errorDetail.aiLastError && (
                  <div className="mt-4 rounded-[16px] border border-red-200/50 bg-red-500/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-500 mb-1">Generation failed</p>
                    <p className="text-[13px] text-red-400">{errorDetail.aiLastError}</p>
                  </div>
                )}
              </div>
            </section>`
);

// Replace Quick Actions section
content = content.replace(
  /<section className="overflow-hidden rounded-3xl border border-border bg-card\/95 p-6 shadow-sm">[\s\S]*?<p className="text-xs font-semibold uppercase tracking-\[0.14em\] text-text-secondary">\s*Quick actions\s*<\/p>[\s\S]*?<h2 className="mt-2 text-xl font-semibold text-text-primary">\s*Stay in flow while triaging\s*<\/h2>[\s\S]*?<div className="mt-5 space-y-3">[\s\S]*?<Link[\s\S]*?className="tf-button flex w-full items-center justify-center px-4 py-2 text-center text-sm"[\s\S]*?href="\/dashboard\/issues"[\s\S]*?>\s*Return to issues inbox\s*<\/Link>[\s\S]*?<button[\s\S]*?type="button"[\s\S]*?className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"[\s\S]*?onClick=\{handleCopyStack\}[\s\S]*?>[\s\S]*?<Copy className="h-4 w-4" \/>[\s\S]*?\{copyStatus \?\? "Copy full stack trace"\}[\s\S]*?<\/button>[\s\S]*?<button[\s\S]*?type="button"[\s\S]*?className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"[\s\S]*?onClick=\{openGithubModal\}[\s\S]*?>[\s\S]*?<Github className="h-4 w-4" \/>[\s\S]*?Create GitHub issue[\s\S]*?<\/button>[\s\S]*?\{\!errorDetail.isManualAlertIssue && \([\s\S]*?<button[\s\S]*?type="button"[\s\S]*?className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"[\s\S]*?onClick=\{handleRegenerate\}[\s\S]*?disabled=\{regenerating \|\| isAiWorkInFlight\(errorDetail\)\}[\s\S]*?>[\s\S]*?<LoadingButtonContent[\s\S]*?loading=\{regenerating\}[\s\S]*?loadingLabel="Generating..."[\s\S]*?idleLabel="Generate AI solution"[\s\S]*?icon=\{Sparkles\}[\s\S]*?\/>[\s\S]*?<\/button>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<\/section>/,
  `<section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Quick Actions
              </h2>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card p-2 shadow-sm space-y-1">
                <Link
                  className="flex items-center justify-between rounded-[16px] p-3 text-[14px] font-medium text-text-primary transition-colors hover:bg-secondary/10"
                  href="/dashboard/issues"
                >
                  Return to issues inbox
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-[16px] p-3 text-[14px] font-medium text-text-primary transition-colors hover:bg-secondary/10"
                  onClick={handleCopyStack}
                >
                  <div className="flex items-center gap-3">
                    <Copy className="h-4 w-4 text-text-secondary" />
                    {copyStatus ?? "Copy full stack trace"}
                  </div>
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-[16px] p-3 text-[14px] font-medium text-text-primary transition-colors hover:bg-secondary/10"
                  onClick={openGithubModal}
                >
                  <div className="flex items-center gap-3">
                    <Github className="h-4 w-4 text-text-secondary" />
                    Create GitHub issue
                  </div>
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                {!errorDetail.isManualAlertIssue && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[16px] p-3 text-[14px] font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 disabled:hover:bg-transparent"
                    onClick={handleRegenerate}
                    disabled={regenerating || isAiWorkInFlight(errorDetail)}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4" />
                      {regenerating ? "Generating..." : "Generate AI solution"}
                    </div>
                    <svg className="h-4 w-4 text-primary/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                )}
              </div>
            </section>`
);

fs.writeFileSync(path, content, 'utf8');
