"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardPagination } from "../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
};

type ReleaseHealth = "healthy" | "monitoring" | "regression";

type ReleaseItem = {
  id: string;
  version: string;
  environment: string | null;
  notes: string | null;
  source: "MANUAL" | "INGEST";
  releasedAt: string;
  createdAt: string;
  health: ReleaseHealth;
  issueCount: number;
  eventCount: number;
  lastEventAt: string | null;
  project: {
    id: string;
    name: string;
  };
  sampleIssues: Array<{
    id: string;
    message: string;
    timestamp: string;
    count: number;
  }>;
};

type ReleaseSummary = {
  total: number;
  healthy: number;
  monitoring: number;
  regressions: number;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const healthClasses: Record<ReleaseHealth, string> = {
  healthy: "tf-success-tag",
  monitoring: "tf-warning-tag",
  regression: "tf-danger-tag"
};

const RELEASE_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

export default function ReleasesPage() {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <ReleasesPageInner />
    </Suspense>
  );
}

function ReleasesPageInner() {
  const searchParams = useSearchParams();
  const hydratedFromQuery = useRef(false);
  const scrolledToHighlight = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [summary, setSummary] = useState<ReleaseSummary>({
    total: 0,
    healthy: 0,
    monitoring: 0,
    regressions: 0
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingRelease, setCreatingRelease] = useState(false);
  const [version, setVersion] = useState("");
  const [releaseEnvironment, setReleaseEnvironment] = useState("production");
  const [notes, setNotes] = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [highlightReleaseId, setHighlightReleaseId] = useState("");
  const [releasesPage, setReleasesPage] = useState(1);
  const [releasesPageSize, setReleasesPageSize] = useState(5);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  const releasesTotalPages = Math.max(1, Math.ceil(releases.length / releasesPageSize));
  const paginatedReleases = useMemo(() => {
    const start = (releasesPage - 1) * releasesPageSize;
    return releases.slice(start, start + releasesPageSize);
  }, [releases, releasesPage, releasesPageSize]);

  useEffect(() => {
    if (hydratedFromQuery.current) return;
    hydratedFromQuery.current = true;

    const queryProjectId = searchParams.get("projectId") || "";
    const queryEnvironment = searchParams.get("environment") || "";
    const queryReleaseId = searchParams.get("releaseId") || "";

    if (queryProjectId) setSelectedProjectId(queryProjectId);
    if (queryEnvironment) setEnvironmentFilter(queryEnvironment);
    if (queryReleaseId) setHighlightReleaseId(queryReleaseId);
  }, [searchParams]);

  const loadProjects = async (token: string) => {
    const res = await fetch(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load projects");
    }
    setProjects(data.projects || []);
  };

  const loadReleases = async (token: string) => {
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    if (environmentFilter) params.set("environment", environmentFilter);

    const res = await fetch(`${API_URL}/releases?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load releases");
    }
    setReleases(data.releases || []);
    setSummary(
      data.summary || {
        total: 0,
        healthy: 0,
        monitoring: 0,
        regressions: 0
      }
    );
  };

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadProjects(token), loadReleases(token)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [selectedProjectId, environmentFilter]);

  useEffect(() => {
    setReleasesPage(1);
  }, [selectedProjectId, environmentFilter]);

  useEffect(() => {
    setReleasesPage((current) => Math.min(current, releasesTotalPages));
  }, [releasesTotalPages]);

  useEffect(() => {
    if (loading) return;
    if (!highlightReleaseId) return;
    if (scrolledToHighlight.current) return;

    const el = document.querySelector(`[data-release-id="${highlightReleaseId}"]`);
    if (el instanceof HTMLElement) {
      scrolledToHighlight.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [highlightReleaseId, loading, releases.length]);

  const regressionRate = useMemo(() => {
    if (!summary.total) {
      return 0;
    }
    return Math.round((summary.regressions / summary.total) * 100);
  }, [summary]);

  const createRelease = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      return;
    }

    if (!selectedProjectId || !version.trim()) {
      showToast("Project and version are required", "error");
      return;
    }

    setCreatingRelease(true);
    try {
      const res = await fetch(`${API_URL}/releases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          version: version.trim(),
          environment: releaseEnvironment,
          notes: notes.trim() || undefined,
          releasedAt: releasedAt || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create release");
      }

      setVersion("");
      setReleaseEnvironment("production");
      setNotes("");
      setReleasedAt("");
      setShowCreateModal(false);
      showToast("Release added", "success");
      await loadReleases(token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create release", "error");
    } finally {
      setCreatingRelease(false);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Releases</p>
            <h1 className="tf-title mt-3 text-3xl">Release health</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Track what shipped, which project it belongs to, and whether new issues
              started appearing after that release.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="tf-button px-4 py-2 text-sm"
              onClick={() => {
                setError(null);
                setShowCreateModal(true);
              }}
            >
              Add release
            </button>
            <Link className="tf-button-ghost px-4 py-2 text-sm" href="/dashboard/issues">
              Open issues
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Total releases
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Healthy
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{summary.healthy}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Monitoring
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{summary.monitoring}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Regression rate
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{regressionRate}%</p>
          </div>
        </section>

        <section className="tf-filter-panel mt-6">
          <div className="tf-filter-grid sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_220px_132px]">
            <label className="tf-filter-field">
              <span className="tf-filter-label">Project</span>
              <select
                className="tf-select tf-filter-control"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tf-filter-field">
              <span className="tf-filter-label">Environment</span>
              <select
                className="tf-select tf-filter-control"
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
              >
                <option value="">All environments</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
                <option value="browser">Browser</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className="tf-filter-reset w-full"
                onClick={() => {
                  setSelectedProjectId("");
                  setEnvironmentFilter("");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {error && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 space-y-4">
          {loading && (
            <div className="rounded-2xl border border-border bg-card/90 p-6 text-sm text-text-secondary">
              Loading releases...
            </div>
          )}

          {!loading && !releases.length && (
            <div className="rounded-2xl border border-border bg-card/90 p-6 text-center">
              <p className="text-sm font-semibold text-text-primary">No releases yet</p>
              <p className="mt-2 text-sm text-text-secondary">
                Add one manually here, or send release tags in ingestion payloads to build a
                real deploy timeline automatically.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="tf-button px-4 py-2 text-sm"
                  onClick={() => setShowCreateModal(true)}
                >
                  Add release
                </button>
                <Link className="tf-button-ghost px-4 py-2 text-sm" href="/docs">
                  View tagging docs
                </Link>
              </div>
            </div>
          )}

          {!loading &&
            paginatedReleases.map((release) => (
              <article
                key={release.id}
                data-release-id={release.id}
                className={`rounded-2xl border bg-card/95 p-5 shadow-sm transition hover:border-primary/25 ${
                  highlightReleaseId && release.id === highlightReleaseId
                    ? "border-primary/40 ring-2 ring-primary/15"
                    : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthClasses[release.health]}`}
                      >
                        {release.health === "healthy"
                          ? "Healthy"
                          : release.health === "monitoring"
                          ? "Monitoring"
                          : "Regression"}
                      </span>
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {release.project.name}
                      </span>
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {release.environment || "All environments"}
                      </span>
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {release.source === "INGEST" ? "Auto-discovered" : "Manual"}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-text-primary">
                      {release.version}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      Released {new Date(release.releasedAt).toLocaleString()}
                    </p>

                    {release.notes && (
                      <p className="mt-3 rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-secondary">
                        {release.notes}
                      </p>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          Issue count
                        </p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          {release.issueCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          Error events
                        </p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          {release.eventCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          Last activity
                        </p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          {release.lastEventAt
                            ? new Date(release.lastEventAt).toLocaleString()
                            : "No linked errors"}
                        </p>
                      </div>
                    </div>

                    {release.sampleIssues.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          Linked issues
                        </p>
                        <div className="mt-3 space-y-2">
                          {release.sampleIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-text-primary">
                                  {issue.message}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {new Date(issue.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <Link
                                href={`/dashboard/errors/${issue.id}`}
                                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                              >
                                Open issue
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </section>

        {releases.length > 5 && !loading && (
          <DashboardPagination
            page={releasesPage}
            totalPages={releasesTotalPages}
            pageSize={releasesPageSize}
            pageSizeOptions={RELEASE_PAGE_SIZE_OPTIONS}
            onPageChange={setReleasesPage}
            onPageSizeChange={(nextSize) => {
              setReleasesPage(1);
              setReleasesPageSize(nextSize);
            }}
          />
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-x-0 top-[73px] bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4 sm:inset-0 sm:items-center sm:px-6 sm:py-6">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:p-6 max-h-full overflow-y-auto sm:max-h-[calc(100dvh-3rem)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                New Release
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
                Add release marker
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                This creates a release checkpoint so you can compare deployment timing with
                issue spikes.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <select
                className="tf-select"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <input
                className="tf-input w-full"
                placeholder="Version, for example v1.8.2"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="tf-select"
                  value={releaseEnvironment}
                  onChange={(event) => setReleaseEnvironment(event.target.value)}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="browser">Browser</option>
                </select>
                <input
                  className="tf-input w-full"
                  type="datetime-local"
                  value={releasedAt}
                  onChange={(event) => setReleasedAt(event.target.value)}
                />
              </div>
              <textarea
                className="min-h-[110px] rounded-[24px] border border-border bg-card px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Optional notes about what shipped"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={() => {
                  setShowCreateModal(false);
                  setVersion("");
                  setNotes("");
                  setReleasedAt("");
                }}
                disabled={creatingRelease}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={createRelease}
                disabled={creatingRelease}
              >
                {creatingRelease ? "Saving..." : "Save release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
