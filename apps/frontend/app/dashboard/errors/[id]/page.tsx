"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  analysis?: { aiExplanation: string; suggestedFix?: string | null } | null;
  events: ErrorEvent[];
  project: { id: string; name: string };
};

type Frame = {
  raw: string;
  file?: string;
  line?: string;
  column?: string;
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

export default function ErrorDetailPage({ params }: { params: { id: string } }) {
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayloads, setShowPayloads] = useState(false);
  const [payloadSearch, setPayloadSearch] = useState("");
  const [showAllFrames, setShowAllFrames] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadDetail = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
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
    try {
      const res = await fetch(`${API_URL}/errors/${params.id}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate explanation");
      }

      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <main className="tf-page">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  if (error || !errorDetail) {
    return (
      <main className="tf-page">
        <p className="text-sm text-red-500">{error ?? "Not found"}</p>
        <Link className="mt-4 inline-block tf-link" href="/dashboard">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const frames = parseStack(errorDetail.stackTrace);
  const visibleFrames = showAllFrames ? frames : frames.slice(0, 6);

  const filteredEvents = useMemo(() => {
    if (!payloadSearch.trim()) return errorDetail.events;
    const needle = payloadSearch.toLowerCase();
    return errorDetail.events.filter((event) => {
      if (!event.payload) return false;
      return JSON.stringify(event.payload).toLowerCase().includes(needle);
    });
  }, [errorDetail.events, payloadSearch]);

  return (
    <main className="tf-page">
      <div className="relative mx-auto max-w-5xl">
          <Link className="tf-link" href="/dashboard">
            ← Back to dashboard
          </Link>
          <header className="mt-4">
            <p className="tf-kicker">{errorDetail.project.name}</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">
                  {errorDetail.message}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  First seen {new Date(errorDetail.firstSeen).toLocaleString()} · Last seen{" "}
                  {new Date(errorDetail.lastSeen).toLocaleString()} · {errorDetail.count} hits
                </p>
              </div>
              <button
                className="tf-button-ghost"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? "Regenerating..." : "Regenerate AI"}
              </button>
            </div>
          </header>

          <div className="tf-divider my-6" />

          <section className="tf-card p-6">
          <div className="tf-row">
            <h2 className="tf-section-title">Stack Trace</h2>
            <div className="flex items-center gap-2">
              <button
                className="tf-pill"
                onClick={() => setShowAllFrames((prev) => !prev)}
              >
                {showAllFrames ? "Collapse" : "Expand"}
              </button>
              <button
                className="tf-pill"
                onClick={handleCopyStack}
              >
                Copy
              </button>
              {copyStatus && <span className="text-xs text-slate-400">{copyStatus}</span>}
            </div>
          </div>
          <div className="mt-4 space-y-2 rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            {visibleFrames.map((frame, index) => (
              <div key={`${frame.raw}-${index}`} className="flex flex-col gap-1">
                <span>{frame.raw}</span>
                {frame.file && (
                  <span className="text-[11px] text-slate-400">
                    {frame.file}:{frame.line}:{frame.column}
                  </span>
                )}
              </div>
            ))}
            {!showAllFrames && frames.length > visibleFrames.length && (
              <p className="text-[11px] text-slate-400">
                Showing {visibleFrames.length} of {frames.length} frames
              </p>
            )}
          </div>
        </section>

          {errorDetail.analysis?.aiExplanation && (
            <section className="tf-card p-6 mt-6">
              <h2 className="tf-section-title">AI Explanation</h2>
              <p className="mt-3 text-sm text-slate-700">
                {errorDetail.analysis.aiExplanation}
              </p>
              {errorDetail.analysis.suggestedFix && (
                <p className="mt-3 text-sm text-slate-700">
                  Suggested fix: {errorDetail.analysis.suggestedFix}
                </p>
              )}
            </section>
          )}

          <section className="tf-card p-6 mt-6">
          <div className="tf-row">
            <h2 className="tf-section-title">Recent Events</h2>
            <div className="flex items-center gap-3">
              <input
                className="tf-input rounded-full px-3 py-1 text-xs"
                placeholder="Search payloads"
                value={payloadSearch}
                onChange={(event) => setPayloadSearch(event.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-500"
                  checked={showPayloads}
                  onChange={(event) => setShowPayloads(event.target.checked)}
                />
                Show payloads
              </label>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {filteredEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <span>{new Date(event.timestamp).toLocaleString()}</span>
                  <span className="text-xs text-slate-400">
                    {event.environment ?? "unknown"}
                  </span>
                </div>
                {showPayloads && event.payload && (
                  <pre className="mt-3 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
{JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {!filteredEvents.length && <p>No events match that payload search.</p>}
          </div>
          </section>
      </div>
    </main>
  );
}
