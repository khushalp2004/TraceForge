"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Github, RotateCcw, Sparkles } from "lucide-react";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type ErrorEvent = {
  id: string;
  timestamp: string;
  environment?: string | null;
  payload?: Record<string, unknown> | null;
};

type ErrorDetail = {
  id: string;
  message: string;
  stackTrace: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  isManualAlertIssue?: boolean;
  aiStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  aiRequestedAt?: string | null;
  aiLastError?: string | null;
  analysis?: { aiExplanation: string; suggestedFix?: string | null } | null;
  events: ErrorEvent[];
  project: {
    id: string;
    name: string;
    githubRepoId?: string | null;
    githubRepoName?: string | null;
    githubRepoUrl?: string | null;
  };
};

type GithubRepo = {
  id: string;
  fullName: string;
  private: boolean;
  url: string;
};

type GithubIntegrationState = {
  configured: boolean;
  connected: boolean;
  repos?: GithubRepo[];
  selectedRepoIds?: string[];
  error?: string;
};

type Frame = {
  raw: string;
  file?: string;
  line?: string;
  column?: string;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const parseStack = (stackTrace: string): Frame[] => {
  return stackTrace
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/\(?([^()]+):(\d+):(\d+)\)?$/);
      if (!match) return { raw: line };
      return {
        raw: line,
        file: match[1],
        line: match[2],
        column: match[3]
      };
    });
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const hasAiResult = (detail: Pick<ErrorDetail, "analysis">) => Boolean(detail.analysis?.aiExplanation);
const hasAiRequest = (detail: Pick<ErrorDetail, "aiRequestedAt" | "analysis">) =>
  Boolean(detail.aiRequestedAt || detail.analysis?.aiExplanation);
const getAiSummary = (detail: Pick<ErrorDetail, "analysis">) =>
  detail.analysis?.aiExplanation?.trim() ?? "";
const getAiDetail = (detail: Pick<ErrorDetail, "analysis">) =>
  detail.analysis?.suggestedFix?.trim() ?? "";

const buildGithubIssueTitle = (detail: Pick<ErrorDetail, "message">) =>
  `[TraceForge] ${detail.message}`.slice(0, 240);

const buildGithubIssueBody = (detail: ErrorDetail) => {
  const issueUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/errors/${detail.id}`
      : `/dashboard/errors/${detail.id}`;

  return [
    "## TraceForge issue",
    "",
    `- Message: ${detail.message}`,
    `- Project: ${detail.project.name}`,
    `- Occurrences: ${detail.count}`,
    `- First seen: ${new Date(detail.firstSeen).toLocaleString()}`,
    `- Last seen: ${new Date(detail.lastSeen).toLocaleString()}`,
    `- TraceForge: ${issueUrl}`,
    detail.analysis?.aiExplanation
      ? ["", "## AI summary", "", detail.analysis.aiExplanation].join("\n")
      : "",
    "",
    "## Stack trace",
    "",
    "```",
    detail.stackTrace,
    "```"
  ]
    .filter(Boolean)
    .join("\n");
};

export default function ErrorDetailPage({ params }: { params: { id: string } }) {
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayloads, setShowPayloads] = useState(false);
  const [payloadSearch, setPayloadSearch] = useState("");
  const [showAllFrames, setShowAllFrames] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [showAiDetail, setShowAiDetail] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [githubRepoId, setGithubRepoId] = useState("");
  const [githubIssueTitle, setGithubIssueTitle] = useState("");
  const [githubIssueBody, setGithubIssueBody] = useState("");
  const [githubModalError, setGithubModalError] = useState<string | null>(null);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [creatingGithubIssue, setCreatingGithubIssue] = useState(false);
  const debouncedPayloadSearch = useDebouncedValue(payloadSearch, 200);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const loadDetail = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/errors/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load error detail");
      }

      setErrorDetail(data.error);
      if (!data.error?.analysis?.suggestedFix) {
        setShowAiDetail(false);
      }
      return data.error as ErrorDetail;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [params.id]);

  const handleCopyStack = async () => {
    if (!errorDetail?.stackTrace) return;
    try {
      await navigator.clipboard.writeText(errorDetail.stackTrace);
      setCopyStatus("Copied!");
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus(null), 1500);
    }
  };

  const handleRegenerate = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setRegenerating(true);
    setAiStatus(null);
    try {
      const res = await fetch(`${API_URL}/errors/${params.id}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate AI solution");
      }

      let ready = false;
      let failed = false;
      const queueDepth = typeof data.queueDepth === "number" ? data.queueDepth : 0;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await wait(1200);
        const detail = await loadDetail();
        if (detail?.aiStatus === "READY" && detail?.analysis?.aiExplanation) {
          ready = true;
          break;
        }

        if (detail?.aiStatus === "FAILED") {
          failed = true;
          break;
        }
      }

      setAiStatus(
        ready
          ? "AI solution ready."
          : failed
          ? "AI solution failed. Check the details below."
          : queueDepth > 1
          ? `Your AI request is under queue (${queueDepth} pending). It will appear when processing finishes.`
          : "Your AI request is under queue. It will appear when processing finishes."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setRegenerating(false);
    }
  };

  const openGithubModal = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !errorDetail) return;

    setShowGithubModal(true);
    setGithubRepos([]);
    setGithubRepoId("");
    setGithubIssueTitle(buildGithubIssueTitle(errorDetail));
    setGithubIssueBody(buildGithubIssueBody(errorDetail));
    setGithubModalError(null);
    setGithubReposLoading(true);

    try {
      const res = await fetch(`${API_URL}/integrations/github`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as GithubIntegrationState;
      if (!res.ok) {
        throw new Error(data.error || "Failed to load GitHub integration");
      }

      setGithubConfigured(Boolean(data.configured));
      setGithubConnected(Boolean(data.connected));
      const selectedRepos = (data.repos || []).filter((repo) =>
        (data.selectedRepoIds || []).includes(repo.id)
      );
      setGithubRepos(selectedRepos);
      const mappedRepoId = errorDetail.project.githubRepoId || "";
      if (mappedRepoId && selectedRepos.some((repo) => repo.id === mappedRepoId)) {
        setGithubRepoId(mappedRepoId);
      } else if (selectedRepos[0]) {
        setGithubRepoId(selectedRepos[0].id);
      }
    } catch (err) {
      setGithubModalError(
        err instanceof Error ? err.message : "Failed to load GitHub repositories"
      );
    } finally {
      setGithubReposLoading(false);
    }
  };

  const createGithubIssueForError = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !errorDetail) return;
    if (!githubRepoId) {
      setGithubModalError("Choose a GitHub repository first");
      return;
    }

    setCreatingGithubIssue(true);
    setGithubModalError(null);

    try {
      const res = await fetch(`${API_URL}/errors/${errorDetail.id}/github-issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repoId: githubRepoId,
          title: githubIssueTitle.trim(),
          body: githubIssueBody.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create GitHub issue");
      }

      setShowGithubModal(false);
      showToast(`GitHub issue #${data.issue?.number || ""} created`.trim(), "success");
    } catch (err) {
      setGithubModalError(
        err instanceof Error ? err.message : "Failed to create GitHub issue"
      );
    } finally {
      setCreatingGithubIssue(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!errorDetail) {
      return [];
    }

    if (!debouncedPayloadSearch.trim()) {
      return errorDetail.events;
    }

    const needle = debouncedPayloadSearch.toLowerCase();
    return errorDetail.events.filter((event) => {
      if (!event.payload) return false;
      return JSON.stringify(event.payload).toLowerCase().includes(needle);
    });
  }, [debouncedPayloadSearch, errorDetail]);

  if (loading) {
    return (
      <main className="tf-page tf-dashboard-page">
        <div className="tf-dashboard">
          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-sm text-text-secondary">Loading issue details…</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !errorDetail) {
    return (
      <main className="tf-page tf-dashboard-page">
        <div className="tf-dashboard">
          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">{error ?? "Not found"}</p>
            <Link className="mt-4 inline-flex tf-link" href="/dashboard/issues">
              Back to issues
            </Link>
          </div>
          {toast && (
            <div className={`tf-dashboard-toast ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
              {toast.message}
            </div>
          )}
        </div>
      </main>
    );
  }

  const frames = parseStack(errorDetail.stackTrace);
  const visibleFrames = showAllFrames ? frames : frames.slice(0, 6);
  const payloadEventCount = errorDetail.events.filter((event) => !!event.payload).length;
  const aiAnalysis = errorDetail.analysis;

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <Link className="tf-link" href="/dashboard/issues">
          ← Back to issues
        </Link>

        <header className="mt-4 overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tf-kicker">{errorDetail.project.name}</p>
              <h1 className="tf-title mt-3 text-2xl sm:text-3xl">{errorDetail.message}</h1>
              <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                {errorDetail.isManualAlertIssue
                  ? "Review the grouped stack and recent event payloads for this manually triggered alert issue without losing the higher-level inbox context."
                  : "Review the grouped stack, recent event payloads, and AI guidance for this issue without losing the higher-level inbox context."}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
              {aiStatus && (
                <span className="w-full text-xs font-semibold text-text-secondary sm:w-auto">{aiStatus}</span>
              )}
              <button
                className="tf-button-ghost inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto"
                onClick={handleCopyStack}
              >
                <Copy className="h-4 w-4" />
                {copyStatus ?? "Copy stack"}
              </button>
              <button
                className="tf-button-ghost inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto"
                onClick={openGithubModal}
              >
                <Github className="h-4 w-4" />
                GitHub issue
              </button>
              {!errorDetail.isManualAlertIssue && (
                <button
                  className="tf-button inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  <LoadingButtonContent
                    loading={regenerating}
                    loadingLabel="Generating..."
                    idleLabel={
                      errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail)
                        ? "Retry AI solution"
                        : hasAiResult(errorDetail)
                        ? "Regenerate AI solution"
                        : "Generate AI solution"
                    }
                    icon={
                      errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail)
                        ? RotateCcw
                        : hasAiResult(errorDetail)
                        ? RotateCcw
                        : Sparkles
                    }
                  />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                First seen
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {new Date(errorDetail.firstSeen).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Last seen
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {new Date(errorDetail.lastSeen).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Occurrences
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {errorDetail.count} hits
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Event payloads
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {payloadEventCount} with context
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Stack trace
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Grouped frames and source locations
                  </h2>
                </div>
                <button
                  className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                  onClick={() => setShowAllFrames((prev) => !prev)}
                >
                  {showAllFrames ? "Collapse frames" : "Show all frames"}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {visibleFrames.map((frame, index) => (
                  <div
                    key={`${frame.raw}-${index}`}
                    className="min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary/20 px-4 py-4"
                  >
                    <div className="overflow-x-auto">
                      <p className="min-w-0 break-all text-sm font-medium text-text-primary">{frame.raw}</p>
                    </div>
                    {frame.file && (
                      <p className="mt-2 break-all text-xs text-text-secondary">
                        {frame.file}:{frame.line}:{frame.column}
                      </p>
                    )}
                  </div>
                ))}
                {!showAllFrames && frames.length > visibleFrames.length && (
                  <p className="text-sm text-text-secondary">
                    Showing {visibleFrames.length} of {frames.length} frames.
                  </p>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Recent events
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    Payloads and environment snapshots
                  </h2>
                </div>
                <span className="w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
                  {filteredEvents.length} events
                </span>
              </div>

              <div className="tf-filter-panel mt-5">
                <div className="tf-filter-header">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Event filters</p>
                    <p className="tf-filter-help">
                      Search payload content or reveal the full payload JSON when you need deeper context.
                    </p>
                  </div>
                </div>
                <div className="tf-filter-grid md:grid-cols-[minmax(0,1fr)_200px]">
                  <label className="tf-filter-field">
                    <span className="tf-filter-label">Payload search</span>
                    <input
                      className="tf-input tf-filter-control min-w-0"
                      placeholder="Search payloads"
                      value={payloadSearch}
                      onChange={(event) => setPayloadSearch(event.target.value)}
                    />
                  </label>
                  <label className="tf-filter-field">
                    <span className="tf-filter-label">Visibility</span>
                    <button
                      type="button"
                      className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                        showPayloads
                          ? "border-primary/30 bg-primary/12 text-primary"
                          : "border-border bg-card text-text-secondary hover:bg-secondary/70 hover:text-text-primary"
                      }`}
                      onClick={() => setShowPayloads((current) => !current)}
                    >
                      {showPayloads ? "Hide payloads" : "Show payloads"}
                    </button>
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary/15 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <p className="break-words text-sm font-semibold text-text-primary">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      <span className="w-fit rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {event.environment ?? "unknown"}
                      </span>
                    </div>
                    {showPayloads && event.payload && (
                      <pre className="mt-3 max-w-full overflow-x-auto rounded-2xl bg-slate-900 p-4 text-[11px] text-slate-100">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {!filteredEvents.length && (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">No matching events</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Try a broader payload search or clear the filter to see recent events again.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                AI solution
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">
                Suggested solution and debugging direction
              </h2>
              {errorDetail.isManualAlertIssue ? (
                <div className="mt-4 rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">
                    AI solution is unavailable
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Manual alert issues are created intentionally, so AI generation is hidden for
                    these records.
                  </p>
                </div>
              ) : hasAiResult(errorDetail) && aiAnalysis ? (
                <>
                  <div className="mt-4 grid gap-4">
                    <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                        Summary
                      </p>
                      <p className="mt-2 break-words text-sm leading-7 text-text-secondary">
                        {getAiSummary(errorDetail)}
                      </p>
                    </div>
                    {getAiDetail(errorDetail) && (
                      <div className="rounded-2xl border border-primary/20 bg-accent-soft px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                              Detailed solution
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              Open the full AI reasoning only when you need deeper debugging help.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-primary/20 bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/35 hover:bg-card/80 max-[639px]:w-full"
                            onClick={() => setShowAiDetail(true)}
                          >
                            View in detail
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">
                    {hasAiRequest(errorDetail) ? "AI solution queued" : "AI solution not generated"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {hasAiRequest(errorDetail)
                      ? "Your request is under queue or currently generating. Refresh shortly if the result does not appear automatically."
                      : "Generate an AI solution when you want a fresh explanation and suggested fix for this grouped issue."}
                  </p>
                </div>
              )}

              {errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail) && errorDetail.aiLastError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">
                    AI generation failed
                  </p>
                  <p className="mt-2 text-sm text-red-700">{errorDetail.aiLastError}</p>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Quick actions
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">
                Stay in flow while triaging
              </h2>
              <div className="mt-5 space-y-3">
                <Link
                  className="tf-button flex w-full items-center justify-center px-4 py-2 text-center text-sm"
                  href="/dashboard/issues"
                >
                  Return to issues inbox
                </Link>
                <button
                  type="button"
                  className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"
                  onClick={handleCopyStack}
                >
                  <Copy className="h-4 w-4" />
                  {copyStatus ?? "Copy full stack trace"}
                </button>
                <button
                  type="button"
                  className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"
                  onClick={openGithubModal}
                >
                  <Github className="h-4 w-4" />
                  Create GitHub issue
                </button>
                {!errorDetail.isManualAlertIssue && (
                  <button
                    type="button"
                    className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                  >
                    <LoadingButtonContent
                      loading={regenerating}
                      loadingLabel="Generating..."
                      idleLabel={
                        errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail)
                          ? "Retry AI solution"
                          : hasAiResult(errorDetail)
                          ? "Regenerate AI solution"
                          : "Generate AI solution"
                      }
                      icon={
                        errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail)
                          ? RotateCcw
                          : hasAiResult(errorDetail)
                          ? RotateCcw
                          : Sparkles
                      }
                    />
                  </button>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      {showAiDetail && getAiDetail(errorDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 sm:px-6">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  AI Solution
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
                  Detailed debugging guidance
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Review the full AI reasoning without expanding the main issue page layout.
                </p>
              </div>
              <button
                type="button"
                className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                onClick={() => setShowAiDetail(false)}
              >
                Close
              </button>
            </div>

            <div className="tf-scroll-rail mt-5 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-primary/15 bg-secondary/20 px-4 py-4 text-sm leading-7 text-text-primary">
              {getAiDetail(errorDetail)}
            </div>
          </div>
        </div>
      )}

      {showGithubModal && (
        <div className="fixed inset-x-0 top-[73px] bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-3 sm:inset-0 sm:items-center sm:px-6 sm:py-6">
          <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:max-h-[min(92vh,48rem)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  GitHub
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
                  Create GitHub issue
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Create a GitHub issue from this TraceForge error using one of your selected
                  repositories.
                </p>
              </div>
            </div>

            <div className="tf-scroll-rail mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  TraceForge issue
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">{errorDetail.message}</p>
              </div>

              {githubReposLoading ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  Loading GitHub repositories...
                </div>
              ) : !githubConfigured ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  GitHub integration is not configured for this app yet.
                </div>
              ) : !githubConnected ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  Connect GitHub in Settings first, then choose one or more repositories to use
                  here.
                </div>
              ) : !githubRepos.length ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  No selected repositories are available. Choose repositories in Settings first.
                </div>
              ) : (
                <>
                  <label className="tf-filter-field">
                    <span className="tf-filter-label">Repository</span>
                    <select
                      className="tf-select tf-filter-control"
                      value={githubRepoId}
                      onChange={(event) => setGithubRepoId(event.target.value)}
                    >
                      {githubRepos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.fullName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="tf-filter-field">
                    <span className="tf-filter-label">Title</span>
                    <input
                      className="tf-input tf-filter-control"
                      value={githubIssueTitle}
                      onChange={(event) => setGithubIssueTitle(event.target.value)}
                    />
                  </label>

                  <label className="tf-filter-field">
                    <span className="tf-filter-label">Description</span>
                    <textarea
                      className="tf-textarea min-h-[180px] sm:min-h-[240px]"
                      value={githubIssueBody}
                      onChange={(event) => setGithubIssueBody(event.target.value)}
                    />
                  </label>
                </>
              )}

              {githubModalError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {githubModalError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex w-full flex-col-reverse gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
              <button
                type="button"
                className="tf-button-ghost inline-flex min-w-0 flex-1 items-center justify-center px-3 py-2 text-sm sm:flex-none sm:px-4"
                onClick={() => setShowGithubModal(false)}
                disabled={creatingGithubIssue}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-button inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-sm sm:flex-none sm:px-4"
                onClick={createGithubIssueForError}
                disabled={
                  githubReposLoading ||
                  !githubConnected ||
                  !githubRepos.length ||
                  !githubRepoId ||
                  creatingGithubIssue
                }
              >
                <LoadingButtonContent
                  loading={creatingGithubIssue}
                  loadingLabel="Creating..."
                  idleLabel="Create GitHub issue"
                  icon={Github}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`tf-dashboard-toast ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}
    </main>
  );
}
