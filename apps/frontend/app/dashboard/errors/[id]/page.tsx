"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Github, Sparkles, X } from "lucide-react";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";
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
  queue?: {
    available: boolean;
    state: "queued" | "processing" | "idle" | "unavailable";
    reason?: "redis_unavailable" | "worker_unhealthy" | null;
    queuePosition: number | null;
    pendingCount: number;
    processingCount: number;
  } | null;
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

type User = {
  id: string;
  email: string;
  plan: "FREE" | "DEV" | "PRO";
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

const hasAiResult = (detail: Pick<ErrorDetail, "analysis">) => Boolean(detail.analysis?.aiExplanation);
const hasAiRequest = (detail: Pick<ErrorDetail, "aiRequestedAt" | "analysis">) =>
  Boolean(detail.aiRequestedAt || detail.analysis?.aiExplanation);
const getAiSummary = (detail: Pick<ErrorDetail, "analysis">) =>
  detail.analysis?.aiExplanation?.trim() ?? "";
const getAiDetail = (detail: Pick<ErrorDetail, "analysis">) =>
  detail.analysis?.suggestedFix?.trim() ?? "";
const isAiWorkInFlight = (detail: Pick<ErrorDetail, "aiStatus" | "aiRequestedAt" | "queue">) => {
  if (detail.queue?.state === "queued" || detail.queue?.state === "processing") {
    return true;
  }

  if (detail.aiStatus === "PROCESSING") {
    return true;
  }

  if (detail.aiStatus === "PENDING" && detail.aiRequestedAt) {
    return true;
  }

  return false;
};
const getQueueStatusMessage = (detail: Pick<ErrorDetail, "queue" | "aiStatus" | "aiRequestedAt">) => {
  if (detail.queue?.state === "unavailable") {
    if (detail.queue.reason === "redis_unavailable") {
      return "AI queue is temporarily unavailable. Please try again shortly.";
    }
    if (detail.queue.reason === "worker_unhealthy") {
      return "AI worker is currently unavailable. Your request will run when worker health recovers.";
    }
    return "AI queue is currently unavailable. Please try again shortly.";
  }

  if (detail.queue?.state === "processing" || detail.aiStatus === "PROCESSING") {
    return "AI solution is currently being generated.";
  }

  if (detail.queue?.state === "queued") {
    const position =
      typeof detail.queue.queuePosition === "number" && detail.queue.queuePosition > 0
        ? ` at position ${detail.queue.queuePosition}`
        : "";
    return `AI solution is queued${position}. It will appear automatically when ready.`;
  }

  if (detail.aiStatus === "PENDING" && detail.aiRequestedAt) {
    return "AI solution is queued. It will appear automatically when ready.";
  }

  return "Generate an AI solution when you want a fresh explanation and suggested fix for this grouped issue.";
};

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
  const [user, setUser] = useState<User | null>(null);
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

  useEffect(() => {
    if (!errorDetail || errorDetail.isManualAlertIssue) {
      return;
    }

    if (errorDetail.aiStatus === "READY" && hasAiResult(errorDetail)) {
      setAiStatus("AI solution ready.");
      return;
    }

    if (errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail)) {
      setAiStatus("AI solution failed. Check the details below.");
      return;
    }

    if (isAiWorkInFlight(errorDetail)) {
      setAiStatus(getQueueStatusMessage(errorDetail));
    }
  }, [errorDetail]);

  const loadDetail = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return null;
    }

    try {
      const [res, userRes] = await Promise.all([
        fetch(`${API_URL}/errors/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const data = await res.json();
      const userData = await userRes.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to load error detail");
      }
      if (!userRes.ok) {
        throw new Error(userData.error || "Failed to load user");
      }

      setErrorDetail(data.error);
      setUser(userData.user);
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

  useEffect(() => {
    if (!errorDetail || errorDetail.isManualAlertIssue || !isAiWorkInFlight(errorDetail)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDetail();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [errorDetail?.id, errorDetail?.aiStatus, errorDetail?.aiRequestedAt, errorDetail?.queue?.state, errorDetail?.isManualAlertIssue]);

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
    try {
      const res = await fetch(`${API_URL}/errors/${params.id}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to generate AI solution", "error");
        return;
      }
      setErrorDetail((current) =>
        current
          ? {
              ...current,
              aiStatus: data.queue?.state === "processing" ? "PROCESSING" : "PENDING",
              aiRequestedAt: new Date().toISOString(),
              aiLastError: null,
              queue: data.queue ?? current.queue ?? null
            }
          : current
      );
      setAiStatus(
        data.queue?.state === "processing"
          ? "AI solution is currently being generated."
          : data.queue?.state === "queued" && data.queue?.queuePosition
          ? `AI solution queued at position ${data.queue.queuePosition}. It will appear automatically when ready.`
          : "AI solution queued. It will appear automatically when ready."
      );
      await loadDetail();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error", "error");
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
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
          <p className="text-[14px] text-text-secondary animate-pulse">Loading issue details…</p>
        </div>
      </main>
    );
  }

  if (error || !errorDetail) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
          <p className="text-[15px] font-semibold text-text-primary">{error ?? "Not found"}</p>
          <Link
            href="/dashboard/issues"
            className="mt-4 group inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Issues
          </Link>
        </div>
        {toast && (
          <div className={`tf-dashboard-toast text-[13px] ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
            {toast.message}
          </div>
        )}
      </main>
    );
  }

  const frames = parseStack(errorDetail.stackTrace);
  const visibleFrames = showAllFrames ? frames : frames.slice(0, 6);
  const payloadEventCount = errorDetail.events.filter((event) => !!event.payload).length;
  const aiAnalysis = errorDetail.analysis;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <Link
          href="/dashboard/issues"
          className="group mb-8 inline-flex items-center gap-2 text-[15px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Issues
        </Link>

        <header className="mb-10 flex flex-col gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
              {errorDetail.project.name}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl break-all">
                {errorDetail.message}
              </h1>
              <PageDescriptionPopover>
                {errorDetail.isManualAlertIssue
                  ? "Review the grouped stack and recent event payloads for this manually triggered alert issue without losing the higher-level inbox context."
                  : "Review the grouped stack, recent event payloads, and AI guidance for this issue without losing the higher-level inbox context."}
              </PageDescriptionPopover>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3">
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
            {aiStatus && (
              <span className="w-full text-[13px] font-medium text-text-secondary sm:w-auto sm:pl-2">{aiStatus}</span>
            )}
          </div>
        </header>

        <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          </div>

        <section className="mb-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-6">
            <section>
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
                      key={`${frame.raw}-${index}`}
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
            </section>

            <section>
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
                      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-medium transition-colors ${
                        showPayloads
                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                          : "bg-secondary/50 text-text-primary hover:bg-secondary/80"
                      }`}
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
                      ? getQueueStatusMessage(errorDetail)
                      : "Generate an AI solution when you want a fresh explanation and suggested fix for this grouped issue."}
                  </p>
                </div>
              )}

              {errorDetail.aiStatus === "FAILED" && hasAiRequest(errorDetail) && errorDetail.aiLastError && (
                <div className="mt-4 rounded-[16px] border tf-danger-surface px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] opacity-90">
                    AI generation failed
                  </p>
                  <p className="mt-2 text-[13px]">An error occurred, try again or switch to different model.</p>
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
                    disabled={regenerating || isAiWorkInFlight(errorDetail)}
                  >
                    <LoadingButtonContent
                      loading={regenerating}
                      loadingLabel="Generating..."
                      idleLabel="Generate AI Solution"
                      icon={Sparkles}
                    />
                  </button>
                )}
              </div>
            </section>
          </div>
        </section>

      {showAiDetail && getAiDetail(errorDetail) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Detailed debugging guidance</h3>
              <button onClick={() => setShowAiDetail(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <p className="text-sm text-text-secondary mb-4">Review the full AI reasoning without expanding the main issue page layout.</p>
               <div className="tf-scroll-rail max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-primary/15 bg-secondary/20 px-4 py-4 text-sm leading-7 text-text-primary">
                 {getAiDetail(errorDetail)}
               </div>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={() => setShowAiDetail(false)} 
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}

      {showGithubModal && (
        <div className="fixed inset-x-0 top-[73px] bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex items-start justify-center overflow-y-auto bg-transparent backdrop-blur-2xl px-3 py-3 sm:inset-0 sm:items-center sm:bg-black/45 sm:backdrop-blur-sm sm:px-6 sm:py-6">
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
