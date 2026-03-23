"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Copy, RotateCcw, Sparkles } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
  orgId?: string | null;
  archivedAt?: string | null;
};

type Issue = {
  id: string;
  projectId: string;
  message: string;
  stackTrace: string;
  count: number;
  lastSeen: string;
  analysis?: {
    aiExplanation: string;
  } | null;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Severity = "critical" | "warning" | "info";

const severityForMessage = (message: string): Severity => {
  const lower = message.toLowerCase();
  if (lower.includes("null") || lower.includes("undefined") || lower.includes("typeerror")) {
    return "critical";
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("rate")) {
    return "warning";
  }
  return "info";
};

const severityClasses: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-border bg-secondary/70 text-text-secondary"
};

const formatRelative = (value: string) => {
  const timestamp = new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function IssuesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 1
  });
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [sortBy, setSortBy] = useState<"lastSeen" | "count">("lastSeen");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Issue | null>(null);
  const [archivingIssueId, setArchivingIssueId] = useState<string | null>(null);
  const [restoringIssueId, setRestoringIssueId] = useState<string | null>(null);
  const deferredSearch = useDebouncedValue(search, 300);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadProjects = async (token: string) => {
    const res = await fetch(`${API_URL}/projects`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load projects");
    }

    setProjects(data.projects || []);
  };

  const loadIssues = async (token: string) => {
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    if (deferredSearch.trim()) params.set("q", deferredSearch.trim());
    if (environmentFilter) params.set("env", environmentFilter);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    if (sortBy) params.set("sort", sortBy);
    if (viewMode === "archived") params.set("archivedOnly", "true");
    params.set("page", String(pagination.page));
    params.set("pageSize", String(pagination.pageSize));

    const res = await fetch(`${API_URL}/errors?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load issues");
    }

    setIssues(data.errors || []);
    setPagination((prev) => ({
      page: data.pagination?.page || prev.page,
      pageSize: data.pagination?.pageSize || prev.pageSize,
      total: data.pagination?.total || 0,
      totalPages: data.pagination?.totalPages || 1
    }));
  };

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return;
    }

    void loadProjects(token).catch((err) => {
      setError(err instanceof Error ? err.message : "Unexpected error");
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      return;
    }

    const reload = async () => {
      setLoading(true);
      setError(null);

      try {
        await loadIssues(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    void reload();
  }, [
    selectedProjectId,
    environmentFilter,
    severityFilter,
    sortBy,
    deferredSearch,
    viewMode,
    pagination.page,
    pagination.pageSize
  ]);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const stats = useMemo(() => {
    const critical = issues.filter(
      (issue) => severityForMessage(issue.message) === "critical"
    ).length;
    const totalHits = issues.reduce((sum, issue) => sum + issue.count, 0);
    const projectCount = new Set(issues.map((issue) => issue.projectId)).size;

    return { critical, totalHits, projectCount };
  }, [issues]);

  const visiblePages = useMemo(() => {
    const totalPages = pagination.totalPages;
    const current = pagination.page;

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (current <= 3) {
      return [1, 2, 3, 4, totalPages];
    }

    if (current >= totalPages - 2) {
      return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, current - 1, current, current + 1, totalPages];
  }, [pagination.page, pagination.totalPages]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [selectedProjectId, environmentFilter, severityFilter, sortBy, deferredSearch, viewMode]);

  const copyStackTrace = async (stackTrace: string) => {
    try {
      await navigator.clipboard.writeText(stackTrace);
      showToast("Stack trace copied", "success");
    } catch {
      showToast("Failed to copy stack trace", "error");
    }
  };

  const regenerateIssue = async (issueId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      return;
    }

    setRegeneratingId(issueId);
    try {
      const res = await fetch(`${API_URL}/errors/${issueId}/regenerate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate AI");
      }

      showToast("AI regeneration queued", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to regenerate AI", "error");
    } finally {
      setRegeneratingId(null);
    }
  };

  const createProject = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      return;
    }

    if (!newProjectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setCreatingProject(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProjectName.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjects((prev) => [data.project, ...prev]);
      setSelectedProjectId(data.project.id);
      setNewProjectName("");
      setShowCreateModal(false);
      showToast("Project created", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
      showToast(message, "error");
    } finally {
      setCreatingProject(false);
    }
  };

  const archiveIssue = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !archiveTarget) {
      return;
    }

    setArchivingIssueId(archiveTarget.id);
    try {
      const res = await fetch(`${API_URL}/errors/${archiveTarget.id}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive issue");
      }

      setIssues((prev) => prev.filter((issue) => issue.id !== archiveTarget.id));
      setArchiveTarget(null);
      showToast("Issue archived", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to archive issue", "error");
    } finally {
      setArchivingIssueId(null);
    }
  };

  const restoreIssue = async (issueId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      return;
    }

    setRestoringIssueId(issueId);
    try {
      const res = await fetch(`${API_URL}/errors/${issueId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore issue");
      }

      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
      showToast("Issue restored", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to restore issue", "error");
    } finally {
      setRestoringIssueId(null);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page lg:h-screen lg:overflow-hidden">
      <div className="tf-dashboard flex min-h-0 flex-col lg:h-full">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Issues</p>
            <h1 className="tf-title mt-3 text-3xl">Issue inbox</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Review incoming application errors, filter by project or environment, and
              jump into detailed debugging without leaving the dashboard.
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
              Create project
            </button>
            <Link
              className="tf-button-ghost px-4 py-2 text-sm"
              href="/dashboard"
            >
              Back to overview
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Active issues
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">
              {pagination.total}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Critical issues
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">{stats.critical}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Affected projects
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">{stats.projectCount}</p>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-border bg-card p-1">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                viewMode === "active"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-secondary hover:bg-secondary/70"
              }`}
              onClick={() => setViewMode("active")}
            >
              Active issues
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                viewMode === "archived"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-secondary hover:bg-secondary/70"
              }`}
              onClick={() => setViewMode("archived")}
            >
              Archived issues
            </button>
          </div>
        </div>

        <section className="tf-filter-panel mt-6">
          <div className="tf-filter-grid sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_220px_200px_200px_160px_132px]">
            <label className="tf-filter-field">
              <span className="tf-filter-label">Search</span>
              <input
                className="tf-input tf-filter-control w-full"
                placeholder="Search issue message"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
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
            <label className="tf-filter-field">
              <span className="tf-filter-label">Severity</span>
              <select
                className="tf-select tf-filter-control"
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as "all" | Severity)
                }
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>
            <label className="tf-filter-field">
              <span className="tf-filter-label">Sort by</span>
              <select
                className="tf-select tf-filter-control"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value === "count" ? "count" : "lastSeen")
                }
              >
                <option value="lastSeen">Last seen</option>
                <option value="count">Most frequent</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className="tf-filter-reset w-full"
                onClick={() => {
                  setSearch("");
                  setSelectedProjectId("");
                  setEnvironmentFilter("");
                  setSeverityFilter("all");
                  setSortBy("lastSeen");
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

        <div className="mt-6 min-h-0 flex-1 rounded-3xl border border-border bg-card/80 p-4 shadow-sm lg:flex lg:flex-col lg:overflow-hidden">
          <section className="tf-scroll-rail min-h-0 space-y-4 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
            {loading && (
              <div className="rounded-2xl border border-border bg-card/90 p-6 text-sm text-text-secondary">
                Loading issues...
              </div>
            )}

            {!loading && !issues.length && (
              <div className="rounded-2xl border border-border bg-card/90 p-6 text-center">
                <p className="text-sm font-semibold text-text-primary">No issues found</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {viewMode === "active"
                    ? "Adjust your filters or send new errors from a project to populate the inbox."
                    : "No archived issues match these filters right now."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {viewMode === "active" && (
                    <button
                      type="button"
                      className="tf-button px-4 py-2 text-sm"
                      onClick={() => {
                        setError(null);
                        setShowCreateModal(true);
                      }}
                    >
                      Create project
                    </button>
                  )}
                  <button
                    className="tf-button-ghost px-4 py-2 text-sm"
                    onClick={() => {
                      setSearch("");
                      setSelectedProjectId("");
                      setEnvironmentFilter("");
                      setSeverityFilter("all");
                      setSortBy("lastSeen");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}

            {!loading &&
              issues.map((issue) => {
                const severity = severityForMessage(issue.message);
                const project = projectMap.get(issue.projectId);

                return (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm transition hover:border-primary/25"
                  >
                    <div className="gap-4 lg:grid lg:grid-cols-[minmax(0,1.45fr)_220px_248px] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses[severity]}`}
                          >
                            {severity === "critical"
                              ? "Critical"
                              : severity === "warning"
                              ? "Warning"
                              : "Info"}
                          </span>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                            {project?.name ?? "Unknown project"}
                          </span>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                            {issue.analysis ? "AI analyzed" : "AI pending"}
                          </span>
                        </div>

                        <h2 className="mt-3 text-lg font-semibold text-text-primary">
                          {issue.message}
                        </h2>

                        <p className="mt-2 line-clamp-2 rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-secondary">
                          {issue.stackTrace}
                        </p>

                        {issue.analysis?.aiExplanation && (
                          <div className="mt-4 rounded-2xl border border-border bg-secondary/50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              AI summary
                            </p>
                            <p className="mt-2 text-sm text-text-secondary">
                              {issue.analysis.aiExplanation}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:grid-cols-1">
                        <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                            Frequency
                          </p>
                          <p className="mt-1 text-sm font-medium text-text-primary">
                            {issue.count} hits
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                            Last seen
                          </p>
                          <p className="mt-1 text-sm font-medium text-text-primary">
                            {formatRelative(issue.lastSeen)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                            Timestamp
                          </p>
                          <p className="mt-1 text-sm font-medium text-text-primary">
                            {new Date(issue.lastSeen).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 w-full lg:mt-0 lg:min-w-[248px]">
                        <div className="rounded-2xl border border-border bg-secondary/20 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                            Actions
                          </p>
                          <div className="mt-3 space-y-2.5">
                            <Link
                              className="tf-button flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
                              href={`/dashboard/errors/${issue.id}`}
                            >
                              Open issue
                            </Link>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                                onClick={() => copyStackTrace(issue.stackTrace)}
                              >
                                <Copy className="h-4 w-4" />
                                Copy stack
                              </button>

                              {viewMode === "active" ? (
                                <button
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                                  onClick={() => regenerateIssue(issue.id)}
                                  disabled={regeneratingId === issue.id}
                                >
                                  <Sparkles className="h-4 w-4" />
                                  {regeneratingId === issue.id ? "Regenerating..." : "Regenerate AI"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                                  onClick={() => restoreIssue(issue.id)}
                                  disabled={restoringIssueId === issue.id}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  {restoringIssueId === issue.id ? "Restoring..." : "Restore"}
                                </button>
                              )}
                            </div>

                            {viewMode === "active" && (
                              <button
                                type="button"
                                className="tf-danger-button inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                                onClick={() => setArchiveTarget(issue)}
                                aria-label="Archive issue"
                                title="Archive issue"
                              >
                                <Archive className="h-4 w-4" />
                                Archive
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </section>

          {!loading && pagination.totalPages > 1 && (
            <div className="mt-4 rounded-2xl border border-border bg-card/90 px-4 py-4 shadow-sm">
              <div className="tf-pagination-bar">
                <div className="tf-pagination-size">
                  <select
                    className="tf-select tf-pagination-select w-full sm:min-w-[98px]"
                    value={pagination.pageSize}
                    onChange={(event) =>
                      setPagination((prev) => ({
                        ...prev,
                        page: 1,
                        pageSize: Number(event.target.value)
                      }))
                    }
                  >
                    <option value="5">5 / page</option>
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                  </select>
                </div>
                <div className="tf-pagination-controls">
                  <button
                    type="button"
                    className="tf-pagination-button"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    disabled={pagination.page === 1}
                  >
                    Prev
                  </button>
                  {visiblePages.map((pageNumber, index) => {
                    const previous = visiblePages[index - 1];
                    const showGap = previous && pageNumber - previous > 1;

                    return (
                      <div key={pageNumber} className="flex items-center gap-2">
                        {showGap && (
                          <span className="tf-pagination-gap">...</span>
                        )}
                        <button
                          type="button"
                          className={`tf-pagination-page ${
                            pagination.page === pageNumber
                              ? "tf-pagination-page-active"
                              : "tf-pagination-page-idle"
                          }`}
                          onClick={() =>
                            setPagination((prev) => ({ ...prev, page: pageNumber }))
                          }
                        >
                          {pageNumber}
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="tf-pagination-button"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1)
                      }))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700 shadow-sm">
                <Archive className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Archive Confirmation
                </p>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  Archive issue
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  This will remove the issue from the active inbox without deleting its underlying
                  data.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Selected issue
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-text-primary">
                  {archiveTarget.message}
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-3">
                <p className="text-sm font-medium text-amber-800">
                  Archived issues stay in the system, but they no longer appear in the active
                  issues inbox.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="min-w-[144px] rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/50 hover:text-text-primary"
                onClick={() => setArchiveTarget(null)}
                disabled={archivingIssueId === archiveTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-danger-button min-w-[144px] rounded-full border px-4 py-2 text-sm font-semibold transition"
                onClick={archiveIssue}
                disabled={archivingIssueId === archiveTarget.id}
              >
                {archivingIssueId === archiveTarget.id ? "Archiving..." : "Archive issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Create project
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Add a project here and start sending issues into this inbox without leaving the page.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-secondary/25 p-4">
              <label className="mb-2 block text-sm font-semibold text-text-primary">
                Project name
              </label>
              <input
                className="tf-input w-full"
                placeholder="Project name"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
              />
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                  setError(null);
                }}
                disabled={creatingProject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={createProject}
                disabled={creatingProject}
              >
                {creatingProject ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}

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
