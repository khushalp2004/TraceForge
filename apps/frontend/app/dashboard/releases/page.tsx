"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";
import { Trash2, Rocket, X } from "lucide-react";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const releasesPrefsKey = "traceforge_releases_prefs_v1";

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

const summarizeReleases = (items: ReleaseItem[]): ReleaseSummary =>
  items.reduce(
    (acc, release) => {
      acc.total += 1;
      if (release.health === "healthy") acc.healthy += 1;
      if (release.health === "monitoring") acc.monitoring += 1;
      if (release.health === "regression") acc.regressions += 1;
      return acc;
    },
    { total: 0, healthy: 0, monitoring: 0, regressions: 0 }
  );

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
  const prefsHydratedRef = useRef(false);
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
  const [deleteTarget, setDeleteTarget] = useState<ReleaseItem | null>(null);
  const [deletingReleaseId, setDeletingReleaseId] = useState<string | null>(null);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const releasesTotalPages = Math.max(1, Math.ceil(releases.length / releasesPageSize));
  const paginatedReleases = useMemo(() => {
    const start = (releasesPage - 1) * releasesPageSize;
    return releases.slice(start, start + releasesPageSize);
  }, [releases, releasesPage, releasesPageSize]);

  useEffect(() => {
    if (hydratedFromQuery.current) return;
    hydratedFromQuery.current = true;

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(releasesPrefsKey);
        if (raw) {
          const prefs = JSON.parse(raw) as {
            projectId?: string;
            environment?: string;
            pageSize?: number;
          };

          if (typeof prefs.projectId === "string") setSelectedProjectId(prefs.projectId);
          if (typeof prefs.environment === "string") setEnvironmentFilter(prefs.environment);
          if (typeof prefs.pageSize === "number" && prefs.pageSize > 0) setReleasesPageSize(prefs.pageSize);
        }
      } catch {
        // Ignore malformed prefs.
      } finally {
        prefsHydratedRef.current = true;
      }
    }

    const queryProjectId = searchParams.get("projectId") || "";
    const queryEnvironment = searchParams.get("environment") || "";
    const queryReleaseId = searchParams.get("releaseId") || "";

    if (queryProjectId) setSelectedProjectId(queryProjectId);
    if (queryEnvironment) setEnvironmentFilter(queryEnvironment);
    if (queryReleaseId) setHighlightReleaseId(queryReleaseId);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
    window.localStorage.setItem(
      releasesPrefsKey,
      JSON.stringify({
        projectId: selectedProjectId,
        environment: environmentFilter,
        pageSize: releasesPageSize
      })
    );
  }, [selectedProjectId, environmentFilter, releasesPageSize]);

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
        if (res.status === 403 && selectedProjectId) {
          setSelectedProjectId("");
          return;
        }
        throw new Error(data.error || "Failed to load releases");
      }
    const nextReleases = (data.releases || []) as ReleaseItem[];
    setReleases(nextReleases);
    setSummary(data.summary || summarizeReleases(nextReleases));
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

  const deleteRelease = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !deleteTarget) {
      return;
    }

    setDeletingReleaseId(deleteTarget.id);
    try {
      const res = await fetch(`${API_URL}/releases/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete release");
      }

      setReleases((prev) => {
        const nextReleases = prev.filter((release) => release.id !== deleteTarget.id);
        setSummary(summarizeReleases(nextReleases));
        return nextReleases;
      });
      showToast("Release deleted", "success");
      setDeleteTarget(null);
      if (highlightReleaseId === deleteTarget.id) {
        setHighlightReleaseId("");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete release", "error");
    } finally {
      setDeletingReleaseId(null);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Releases</p>
            <div className="mt-3 flex items-center">
              <h1 className="tf-title text-3xl">Release health</h1>
              <PageDescriptionPopover>
                Track what shipped, which project it belongs to, and whether new issues
                started appearing after that release.
              </PageDescriptionPopover>
            </div>
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

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-secondary/10 px-4 py-3 flex flex-col justify-center shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                          Issue count
                        </p>
                        <p className="mt-1 text-base font-semibold text-text-primary">
                          {release.issueCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-secondary/10 px-4 py-3 flex flex-col justify-center shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                          Error events
                        </p>
                        <p className="mt-1 text-base font-semibold text-text-primary">
                          {release.eventCount}
                        </p>
                      </div>
                      <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-secondary/10 px-4 py-3 flex flex-col justify-center shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                          Last activity
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text-primary truncate">
                          {release.lastEventAt
                            ? new Date(release.lastEventAt).toLocaleString()
                            : "No linked errors"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start mt-1 sm:mt-0">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                      onClick={() => setDeleteTarget(release)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {release.sampleIssues.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                      Linked issues
                    </p>
                    <div className="mt-3 space-y-2">
                      {release.sampleIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3"
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
                            className="tf-button-ghost shrink-0 px-3 py-1.5 text-xs sm:w-auto w-full text-center"
                          >
                            Open issue
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg max-h-[70vh] sm:max-h-[90vh] rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Add release marker</h3>
              <button onClick={() => {
                  setShowCreateModal(false);
                  setVersion("");
                  setNotes("");
                  setReleasedAt("");
                }} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               <p className="text-sm text-text-secondary mb-6">Create a release checkpoint to compare deployment timing with issue spikes.</p>

               <div className="space-y-5">
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     Project
                   </label>
                   <select
                     className="w-full appearance-none rounded-xl border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     style={{
                       backgroundImage:
                         "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                       backgroundRepeat: "no-repeat",
                       backgroundPosition: "right 16px center",
                       backgroundSize: "12px 12px"
                     }}
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
                 </div>

                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     Version
                   </label>
                   <input
                     className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     placeholder="e.g. v1.8.2"
                     value={version}
                     onChange={(event) => setVersion(event.target.value)}
                   />
                 </div>

                 <div className="grid gap-5 sm:grid-cols-2">
                   <div>
                     <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                       Environment
                     </label>
                     <select
                       className="w-full appearance-none rounded-xl border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                       style={{
                         backgroundImage:
                           "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                         backgroundRepeat: "no-repeat",
                         backgroundPosition: "right 16px center",
                         backgroundSize: "12px 12px"
                       }}
                       value={releaseEnvironment}
                       onChange={(event) => setReleaseEnvironment(event.target.value)}
                     >
                       <option value="production">Production</option>
                       <option value="staging">Staging</option>
                       <option value="development">Development</option>
                       <option value="browser">Browser</option>
                     </select>
                   </div>
                   <div>
                     <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                       Release Date
                     </label>
                     <input
                       className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 [color-scheme:dark]"
                       type="datetime-local"
                       value={releasedAt}
                       onChange={(event) => setReleasedAt(event.target.value)}
                     />
                   </div>
                 </div>

                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     Release Notes
                   </label>
                   <textarea
                     className="min-h-[100px] w-full resize-none rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     placeholder="Optional notes about what shipped in this version..."
                     value={notes}
                     onChange={(event) => setNotes(event.target.value)}
                   />
                 </div>
               </div>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-4 border-t border-border/50 shrink-0">
               <button 
                 onClick={createRelease} 
                 disabled={creatingRelease}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={creatingRelease} loadingLabel="Saving..." idleLabel="Save release" />
               </button>
               <button 
                 onClick={() => {
                   setShowCreateModal(false);
                   setVersion("");
                   setNotes("");
                   setReleasedAt("");
                 }} 
                 disabled={creatingRelease}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Delete Release</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to delete this release?</h4>
               <p className="text-sm text-text-secondary">This action is permanent and cannot be undone. Linked error events will be preserved but association will be lost.</p>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={deleteRelease} 
                 disabled={deletingReleaseId === deleteTarget.id}
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setDeleteTarget(null)} 
                 disabled={deletingReleaseId === deleteTarget.id}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
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
