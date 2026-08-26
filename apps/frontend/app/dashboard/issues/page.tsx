"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, Copy, Github, RotateCcw, Sparkles, Trash2, PlusCircle, Edit3, X, Search, Clock, Activity, ExternalLink } from "lucide-react";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { DashboardPagination } from "../components/DashboardPagination";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";
const tokenKey = "traceforge_token";
const issuesPrefsKey = "traceforge_issues_prefs_v1";

type Project = {
  id: string;
  name: string;
  orgId?: string | null;
  archivedAt?: string | null;
  githubRepoId?: string | null;
  githubRepoName?: string | null;
  githubRepoUrl?: string | null;
};

type Issue = {
  id: string;
  projectId: string;
  message: string;
  stackTrace: string;
  count: number;
  lastSeen: string;
  isManualAlertIssue?: boolean;
  aiStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  aiRequestedAt?: string | null;
  aiLastError?: string | null;
  queue?: {
    available: boolean;
    state: "queued" | "processing" | "idle" | "unavailable";
    queuePosition: number | null;
    pendingCount: number;
    processingCount: number;
  } | null;
  analysis?: {
    aiExplanation: string;
    suggestedFix?: string | null;
  } | null;
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
  critical: "tf-danger-tag",
  warning: "tf-warning-tag",
  info: "tf-muted-tag"
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

const hasAiResult = (issue: Pick<Issue, "analysis">) => Boolean(issue.analysis?.aiExplanation);
const hasAiRequest = (issue: Pick<Issue, "aiRequestedAt" | "analysis">) =>
  Boolean(issue.aiRequestedAt || issue.analysis?.aiExplanation);
const getAiSummary = (issue: Pick<Issue, "analysis">) => issue.analysis?.aiExplanation?.trim() ?? "";
const isAiWorkInFlight = (issue: Pick<Issue, "aiStatus">) =>
  issue.aiStatus === "PENDING" || issue.aiStatus === "PROCESSING";
const getQueueStatusMessage = (issue: Pick<Issue, "queue" | "aiStatus">) => {
  if (issue.queue?.state === "processing" || issue.aiStatus === "PROCESSING") {
    return "AI solution is generating now.";
  }

  if (issue.queue?.state === "queued") {
    const position =
      typeof issue.queue.queuePosition === "number" && issue.queue.queuePosition > 0
        ? ` · #${issue.queue.queuePosition}`
        : "";
    return `AI queued${position}`;
  }

  if (issue.aiStatus === "PENDING") {
    return "AI queued";
  }

  return "AI not generated";
};
const getAiBadgeLabel = (issue: Pick<Issue, "aiStatus" | "aiRequestedAt" | "analysis" | "queue">) => {
  if (hasAiResult(issue)) return "AI solution ready";
  if (issue.aiStatus === "FAILED" && hasAiRequest(issue)) return "AI failed";
  if (isAiWorkInFlight(issue) && hasAiRequest(issue)) return getQueueStatusMessage(issue);
  return "AI not generated";
};

const buildGithubIssueTitle = (issue: Pick<Issue, "message">) =>
  `[TraceForge] ${issue.message}`.slice(0, 240);

const buildGithubIssueBody = (issue: Issue, projectName?: string) => {
  const issueUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/errors/${issue.id}`
      : `/dashboard/errors/${issue.id}`;

  return [
    `## TraceForge issue`,
    ``,
    `- Message: ${issue.message}`,
    `- Project: ${projectName || "Unknown project"}`,
    `- Occurrences: ${issue.count}`,
    `- Last seen: ${new Date(issue.lastSeen).toLocaleString()}`,
    `- TraceForge: ${issueUrl}`,
    issue.analysis?.aiExplanation
      ? [``, `## AI summary`, ``, issue.analysis.aiExplanation].join("\n")
      : "",
    ``,
    `## Stack trace`,
    ``,
    "```",
    issue.stackTrace,
    "```"
  ]
    .filter(Boolean)
    .join("\n");
};

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <IssuesPageInner />
    </Suspense>
  );
}

function IssuesPageInner() {
  const searchParams = useSearchParams();
  const hydratedFromQuery = useRef(false);
  const prefsHydratedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const [user, setUser] = useState<User | null>(null);
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
  const [newProjectAiModel, setNewProjectAiModel] = useState("groq/compound");
  const [newProjectGithubRepoId, setNewProjectGithubRepoId] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Issue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [githubIssueTarget, setGithubIssueTarget] = useState<Issue | null>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [githubRepoId, setGithubRepoId] = useState("");
  const [githubIssueTitle, setGithubIssueTitle] = useState("");
  const [githubIssueBody, setGithubIssueBody] = useState("");
  const [githubModalError, setGithubModalError] = useState<string | null>(null);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [archivingIssueId, setArchivingIssueId] = useState<string | null>(null);
  const [restoringIssueId, setRestoringIssueId] = useState<string | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [creatingGithubIssueId, setCreatingGithubIssueId] = useState<string | null>(null);
  const deferredSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (hydratedFromQuery.current) return;
    hydratedFromQuery.current = true;

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(issuesPrefsKey);
        if (raw) {
          const prefs = JSON.parse(raw) as {
            search?: string;
            projectId?: string;
            environment?: string;
            severity?: "all" | Severity;
            sortBy?: "lastSeen" | "count";
            viewMode?: "active" | "archived";
            pageSize?: number;
          };

          if (typeof prefs.search === "string") setSearch(prefs.search);
          if (typeof prefs.projectId === "string") setSelectedProjectId(prefs.projectId);
          if (typeof prefs.environment === "string") setEnvironmentFilter(prefs.environment);
          if (prefs.severity === "all" || prefs.severity === "critical" || prefs.severity === "warning" || prefs.severity === "info") {
            setSeverityFilter(prefs.severity);
          }
          if (prefs.sortBy === "lastSeen" || prefs.sortBy === "count") setSortBy(prefs.sortBy);
          if (prefs.viewMode === "active" || prefs.viewMode === "archived") setViewMode(prefs.viewMode);
          if (typeof prefs.pageSize === "number" && prefs.pageSize > 0) {
            const nextPageSize = prefs.pageSize;
            setPagination((prev) => ({ ...prev, pageSize: nextPageSize }));
          }
        }
      } catch {
        // Ignore malformed prefs.
      } finally {
        prefsHydratedRef.current = true;
      }
    }

    const queryProjectId = searchParams.get("projectId") || "";
    const queryEnv = searchParams.get("env") || "";
    const querySeverity = (searchParams.get("severity") || "").toLowerCase();
    const querySort = (searchParams.get("sort") || "").toLowerCase();
    const queryQ = searchParams.get("q") || "";
    const queryArchivedOnly = searchParams.get("archivedOnly") || "";
    const queryPage = Number(searchParams.get("page") || "");
    const queryPageSize = Number(searchParams.get("pageSize") || "");

    if (queryProjectId) setSelectedProjectId(queryProjectId);
    if (queryEnv) setEnvironmentFilter(queryEnv);
    if (queryQ) setSearch(queryQ);
    if (queryArchivedOnly === "true") setViewMode("archived");

    if (querySeverity === "critical" || querySeverity === "warning" || querySeverity === "info") {
      setSeverityFilter(querySeverity);
    }

    if (querySort === "lastseen" || querySort === "count") {
      setSortBy(querySort === "lastseen" ? "lastSeen" : "count");
    }

    if (Number.isFinite(queryPage) && queryPage > 0) {
      setPagination((prev) => ({ ...prev, page: queryPage }));
    }

    if (Number.isFinite(queryPageSize) && queryPageSize > 0) {
      setPagination((prev) => ({ ...prev, pageSize: queryPageSize }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
    window.localStorage.setItem(
      issuesPrefsKey,
      JSON.stringify({
        search,
        projectId: selectedProjectId,
        environment: environmentFilter,
        severity: severityFilter,
        sortBy,
        viewMode,
        pageSize: pagination.pageSize
      })
    );
  }, [search, selectedProjectId, environmentFilter, severityFilter, sortBy, viewMode, pagination.pageSize]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const loadProjectsAndUser = async (token: string) => {
    const [projectsRes, userRes] = await Promise.all([
      fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const projectsData = await projectsRes.json();
    const userData = await userRes.json();

    if (!projectsRes.ok) {
      throw new Error(projectsData.error || "Failed to load projects");
    }
    if (!userRes.ok) {
      throw new Error(userData.error || "Failed to load user");
    }

    setProjects(projectsData.projects || []);
    setUser(userData.user);
  };

  const loadIssues = async (token: string) => {
    const fetchId = ++fetchIdRef.current;
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
      if (res.status === 403 && selectedProjectId) {
        setSelectedProjectId("");
        return;
      }
      throw new Error(data.error || "Failed to load issues");
    }

    if (fetchId !== fetchIdRef.current) {
      return;
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

    void loadProjectsAndUser(token).catch((err) => {
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

  useEffect(() => {
    if (!issues.some((issue) => !issue.isManualAlertIssue && isAiWorkInFlight(issue))) {
      return;
    }

    const token = localStorage.getItem(tokenKey);
    if (!token) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadIssues(token).catch(() => { });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [
    issues,
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
        throw new Error(data.error || "Failed to generate AI solution");
      }
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          issue.id === issueId
            ? {
              ...issue,
              aiStatus: data.status ?? "PENDING",
              aiRequestedAt: new Date().toISOString(),
              aiLastError: null,
              queue: data.queue ?? issue.queue ?? null
            }
            : issue
        )
      );
      showToast(
        data.queue?.state === "processing"
          ? "AI solution is being generated now. It will appear automatically when ready."
          : data.queue?.state === "queued" && data.queue?.queuePosition
            ? `AI solution queued at position ${data.queue.queuePosition}. It will appear automatically when ready.`
            : "AI solution queued. It will appear automatically when ready.",
        "success"
      );
      void loadIssues(token).catch(() => { });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate AI solution", "error");
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
        body: JSON.stringify({
          name: newProjectName.trim(),
          aiModel: newProjectAiModel,
          githubRepoId: newProjectGithubRepoId.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjects((prev) => [data.project, ...prev]);
      setSelectedProjectId(data.project.id);
      setNewProjectName("");
      setNewProjectAiModel("groq/compound");
      setNewProjectGithubRepoId("");
      setShowCreateModal(false);
      showToast("Project created", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
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

  const deleteIssuePermanently = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !deleteTarget) {
      return;
    }

    setDeletingIssueId(deleteTarget.id);
    try {
      const res = await fetch(`${API_URL}/errors/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete issue");
      }

      setIssues((prev) => prev.filter((issue) => issue.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Issue deleted permanently", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete issue", "error");
    } finally {
      setDeletingIssueId(null);
    }
  };

  const openGithubIssueModal = async (issue: Issue) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      return;
    }

    setGithubIssueTarget(issue);
    setGithubRepos([]);
    setGithubRepoId("");
    setGithubIssueTitle(buildGithubIssueTitle(issue));
    setGithubIssueBody(buildGithubIssueBody(issue, projectMap.get(issue.projectId)?.name));
    setGithubModalError(null);
    setGithubReposLoading(true);

    try {
      const res = await fetch(`${API_URL}/integrations/github`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
      const mappedRepoId = projectMap.get(issue.projectId)?.githubRepoId || "";
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

  const createGithubIssueForTarget = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !githubIssueTarget) {
      return;
    }

    if (!githubRepoId) {
      setGithubModalError("Choose a GitHub repository first");
      return;
    }

    setCreatingGithubIssueId(githubIssueTarget.id);
    setGithubModalError(null);

    try {
      const res = await fetch(`${API_URL}/errors/${githubIssueTarget.id}/github-issue`, {
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

      setGithubIssueTarget(null);
      showToast(
        `GitHub issue #${data.issue?.number || ""} created`.trim(),
        "success"
      );
    } catch (err) {
      setGithubModalError(
        err instanceof Error ? err.message : "Failed to create GitHub issue"
      );
    } finally {
      setCreatingGithubIssueId(null);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page lg:h-screen lg:overflow-hidden">
      <div className="tf-dashboard flex min-h-0 flex-col lg:h-full">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Issue inbox</h1>
            <PageDescriptionPopover>
              Manage and resolve issues reported across your projects.
            </PageDescriptionPopover>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-sm bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border/40 hover:text-text-primary hover:border-border transition shadow-sm"
              onClick={() => {
                setError(null);
                setShowCreateModal(true);
              }}
            >
              Create project
            </button>
          </div>
        </header>
        <section className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Active issues", value: pagination.total },
              { label: "Critical issues", value: stats.critical },
              { label: "Affected projects", value: stats.projectCount }
            ].map((stat) => (
              <div key={stat.label} className="group relative overflow-hidden rounded-sm border border-border bg-card/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-sm bg-primary/5 blur-2xl transition-opacity group-hover:bg-primary/10" />
                <p className="relative z-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{stat.label}</p>
                <p className="relative z-10 mt-2 text-2xl font-bold text-text-primary sm:text-3xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-sm bg-secondary/30 p-1">
            <button
              className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-all ${
                viewMode === "active" ? "bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("active")}
            >
              Active issues
            </button>
            <button
              className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-all ${
                viewMode === "archived" ? "bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("archived")}
            >
              Archived issues
            </button>
          </div>

          <div className="flex flex-1 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            <input
              className="tf-input !h-9 !bg-secondary/40 !border-transparent hover:!border-border/50 focus:!bg-card focus:!border-primary/30 transition text-xs flex-1 min-w-0 sm:min-w-[200px]"
              placeholder="Search issues..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
              <select
                className="tf-select !h-9 !bg-secondary/40 !border-transparent hover:!border-border/50 focus:!bg-card focus:!border-primary/30 transition text-xs w-full sm:w-auto"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              
              <select
                className="tf-select !h-9 !bg-secondary/40 !border-transparent hover:!border-border/50 focus:!bg-card focus:!border-primary/30 transition text-xs w-full sm:w-auto"
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
              >
                <option value="">All environments</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
                <option value="browser">Browser</option>
              </select>
              
              <select
                className="tf-select !h-9 !bg-secondary/40 !border-transparent hover:!border-border/50 focus:!bg-card focus:!border-primary/30 transition text-xs w-full sm:w-auto"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as "all" | Severity)}
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>

              <select
                className="tf-select !h-9 !bg-secondary/40 !border-transparent hover:!border-border/50 focus:!bg-card focus:!border-primary/30 transition text-xs w-full sm:w-auto"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value === "count" ? "count" : "lastSeen")}
              >
                <option value="lastSeen">Sort: Last seen</option>
                <option value="count">Sort: Frequent</option>
              </select>
            </div>
            
            <button
              className="text-[11px] font-semibold text-text-secondary hover:text-text-primary transition self-start sm:self-auto mt-1 sm:mt-0"
              onClick={() => {
                setSearch("");
                setSelectedProjectId("");
                setEnvironmentFilter("");
                setSeverityFilter("all");
                setSortBy("lastSeen");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 flex flex-col lg:overflow-hidden">
          <section className="tf-scroll-rail min-h-0 space-y-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain pr-2">
            {loading && (
              <div className="py-6 text-center text-sm text-text-secondary">
                Loading issues...
              </div>
            )}

            {!loading && !issues.length && (
              <div className="py-12 text-center animate-fade-up">
                <p className="text-[15px] font-semibold text-text-primary">No issues found</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {viewMode === "active" && (
                    <button
                      type="button"
                      className="rounded-sm bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors"
                      onClick={() => {
                        setError(null);
                        setShowCreateModal(true);
                      }}
                    >
                      Create project
                    </button>
                  )}
                  <button
                    className="rounded-sm bg-secondary/30 hover:bg-secondary/50 px-4 py-2 text-sm font-semibold text-text-primary transition-colors"
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

            {!loading && issues.length > 0 && (
              <div className="flex flex-col gap-3 pb-8">
                {issues.map((issue) => {
                  const severity = severityForMessage(issue.message);
                  const project = projectMap.get(issue.projectId);

                  return (
                    <div
                      key={issue.id}
                      className="group relative flex flex-col lg:flex-row lg:items-center justify-between p-5 gap-4 rounded-sm bg-card border border-border/40 hover:border-border transition-all duration-200"
                    >
                      {/* Left: Content Area */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Severity Indicator */}
                        <div className="mt-1.5 shrink-0 flex items-center justify-center">
                          {severity === "critical" ? (
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                          ) : severity === "warning" ? (
                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          )}
                        </div>

                        {/* Title and Meta */}
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link href={`/dashboard/errors/${issue.id}`} className="text-[15px] font-semibold text-text-primary hover:text-primary transition-colors truncate max-w-[80%]">
                              {issue.message}
                            </Link>
                            <span className="shrink-0 text-[11px] font-medium text-text-secondary/50">
                              {project?.name ?? "Unknown"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-text-secondary/70">
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatRelative(issue.lastSeen)}</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> {issue.count} events</span>
                          </div>

                          {/* Minimal Stack Trace */}
                          <div className="mt-2 text-[11px] font-mono text-text-secondary/50 truncate border-l-2 border-border/60 pl-3 py-0.5">
                            {issue.stackTrace.split('\n')[0]}
                          </div>

                          {/* AI Summary Inline */}
                          {issue.analysis?.aiExplanation && (
                            <div className="mt-2 text-[11px] text-text-secondary border-l-2 border-primary/50 pl-3 py-0.5 line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                              <strong className="text-primary mr-1">AI</strong> 
                              {getAiSummary(issue)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions Container */}
                      <div className="shrink-0 flex items-center gap-2 lg:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 mt-4 lg:mt-0">
                        <Link
                          className="flex items-center justify-center h-8 px-3 rounded-sm text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors"
                          href={`/dashboard/errors/${issue.id}`}
                        >
                          View
                        </Link>
                        
                        <div className="w-px h-4 bg-border/50 mx-1"></div>

                        <button
                          type="button"
                          className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors"
                          onClick={() => copyStackTrace(issue.stackTrace)}
                          title="Copy Stack Trace"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        
                        <button
                          type="button"
                          className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors disabled:opacity-50"
                          onClick={() => openGithubIssueModal(issue)}
                          disabled={creatingGithubIssueId === issue.id}
                          title="Create GitHub Issue"
                        >
                          {creatingGithubIssueId === issue.id ? <div className="h-4 w-4 rounded-full border-2 border-text-secondary border-t-transparent animate-spin"></div> : <Github className="h-4 w-4" />}
                        </button>

                        {viewMode === "active" && !issue.isManualAlertIssue && (
                          <button
                            type="button"
                            className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors disabled:opacity-50"
                            onClick={() => regenerateIssue(issue.id)}
                            disabled={regeneratingId === issue.id || isAiWorkInFlight(issue)}
                            title="Regenerate AI Analysis"
                          >
                            {regeneratingId === issue.id ? <div className="h-4 w-4 rounded-full border-2 border-text-secondary border-t-transparent animate-spin"></div> : <Sparkles className="h-4 w-4" />}
                          </button>
                        )}
                        
                        {viewMode === "archived" && (
                          <button
                            type="button"
                            className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors disabled:opacity-50"
                            onClick={() => restoreIssue(issue.id)}
                            disabled={restoringIssueId === issue.id}
                            title="Restore Issue"
                          >
                            {restoringIssueId === issue.id ? <div className="h-4 w-4 rounded-full border-2 border-text-secondary border-t-transparent animate-spin"></div> : <RotateCcw className="h-4 w-4" />}
                          </button>
                        )}

                        <div className="w-px h-4 bg-border/50 mx-1"></div>

                        {viewMode === "active" && (
                          <button
                            type="button"
                            className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-secondary/40 transition-colors"
                            onClick={() => setArchiveTarget(issue)}
                            title="Archive Issue"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}

                        {viewMode === "archived" && (
                          <button
                            type="button"
                            className="p-1.5 rounded-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            onClick={() => setDeleteTarget(issue)}
                            disabled={deletingIssueId === issue.id}
                            title="Delete Issue"
                          >
                            {deletingIssueId === issue.id ? <div className="h-4 w-4 rounded-full border-2 border-destructive/80 border-t-transparent animate-spin"></div> : <Trash2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {!loading && pagination.total > 5 && (
            <DashboardPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              pageSizeOptions={[
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 20, label: "20" }
              ]}
              onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) =>
                setPagination((prev) => ({ ...prev, page: 1, pageSize }))
              }
              className="mt-4"
            />
          )}
        </div>
      </div>

      {archiveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 pt-20 pb-24 sm:p-8 sm:pt-[72px] sm:pb-8">
          <div className="w-full max-w-lg max-h-full rounded-sm border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Archive Issue</h3>
              <button onClick={() => setArchiveTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 p-6 overflow-y-auto">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to archive this issue?</h4>
               <p className="text-sm text-text-secondary">Archived issues are hidden from your primary inbox but remain accessible for historical reference and audit.</p>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={archiveIssue} 
                 disabled={archivingIssueId === archiveTarget.id}
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md font-semibold py-2 px-4 rounded-sm transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Archive
               </button>
               <button 
                 onClick={() => setArchiveTarget(null)} 
                 disabled={archivingIssueId === archiveTarget.id}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 pt-20 pb-24 sm:p-8 sm:pt-[72px] sm:pb-8">
          <div className="w-full max-w-lg max-h-full rounded-sm border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Delete Issue</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 p-6 overflow-y-auto">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to delete this issue?</h4>
               <p className="text-sm text-text-secondary">This action is permanent and cannot be undone.</p>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={deleteIssuePermanently} 
                 disabled={deletingIssueId === deleteTarget.id}
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md font-semibold py-2 px-4 rounded-sm transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setDeleteTarget(null)} 
                 disabled={deletingIssueId === deleteTarget.id}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 pt-20 pb-24 sm:p-8 sm:pt-[72px] sm:pb-8">
          <div className="w-full max-w-lg max-h-full rounded-sm border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Create Project</h3>
              <button onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                  setNewProjectAiModel("groq/compound");
                  setNewProjectGithubRepoId("");
                }} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               <p className="text-sm text-text-secondary mb-6">Add a new workspace to track issues and deployments.</p>
               
               <div className="space-y-5">
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     Project name
                   </label>
                   <input
                     className="w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     placeholder="e.g. Website Frontend"
                     value={newProjectName}
                     onChange={(event) => setNewProjectName(event.target.value)}
                     autoFocus
                   />
                 </div>
                 
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     AI Analysis Model
                   </label>
                   <select
                     className="w-full appearance-none rounded-sm border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     style={{
                       backgroundImage:
                         "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                       backgroundRepeat: "no-repeat",
                       backgroundPosition: "right 16px center",
                       backgroundSize: "12px 12px"
                     }}
                     value={newProjectAiModel}
                     onChange={(event) => setNewProjectAiModel(event.target.value)}
                   >
                     <option value="allam-2-7b">Allam 2 7B</option>
                     <option value="groq/compound">Compound</option>
                     <option value="groq/compound-mini">Compound Mini</option>
                     <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                     <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
                     <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
                   </select>
                 </div>
  
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     GitHub Repository (Optional)
                   </label>
                   <select
                     className="w-full appearance-none rounded-sm border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                     style={{
                       backgroundImage:
                         "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                       backgroundRepeat: "no-repeat",
                       backgroundPosition: "right 16px center",
                       backgroundSize: "12px 12px"
                     }}
                     value={newProjectGithubRepoId}
                     onChange={(event) => setNewProjectGithubRepoId(event.target.value)}
                     disabled={!githubConfigured || !githubConnected}
                   >
                     <option value="">
                       {githubConnected ? "No linked repository" : "Connect GitHub in Settings"}
                     </option>
                     {githubRepos.map((repo) => (
                       <option key={repo.id} value={repo.id}>
                         {repo.fullName}
                       </option>
                     ))}
                   </select>
                 </div>
               </div>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-4 border-t border-border/50 shrink-0">
               <button 
                 onClick={createProject} 
                 disabled={creatingProject || !newProjectName.trim()}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={creatingProject} loadingLabel="Creating..." idleLabel="Create project" icon={PlusCircle} />
               </button>
               <button 
                 onClick={() => {
                   setShowCreateModal(false);
                   setNewProjectName("");
                   setNewProjectAiModel("groq/compound");
                   setNewProjectGithubRepoId("");
                 }} 
                 disabled={creatingProject}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {githubIssueTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 pt-20 pb-24 sm:p-8 sm:pt-[72px] sm:pb-8">
          <div className="w-full max-w-lg max-h-full rounded-sm border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Create GitHub issue</h3>
              <button onClick={() => setGithubIssueTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 p-6 overflow-y-auto">
               <p className="text-sm text-text-secondary mb-6">Send this TraceForge issue to one of your selected repositories without leaving the dashboard.</p>
               
               <div className="space-y-5">
                 <div className="rounded-sm border border-border bg-secondary/20 p-4">
                   <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     TraceForge issue
                   </p>
                   <p className="mt-2 text-sm font-medium text-text-primary">
                     {githubIssueTarget.message}
                   </p>
                 </div>

                 {githubReposLoading ? (
                   <div className="rounded-sm border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                     Loading GitHub repositories...
                   </div>
                 ) : !githubConfigured ? (
                   <div className="rounded-sm border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                     GitHub integration is not configured for this app yet.
                   </div>
                 ) : !githubConnected ? (
                   <div className="rounded-sm border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                     Connect GitHub in Settings first, then choose one or more repositories to use here.
                   </div>
                 ) : !githubRepos.length ? (
                   <div className="rounded-sm border border-border bg-secondary/20 p-4 text-sm text-text-secondary">
                     No selected repositories are available. Choose repositories in Settings first.
                   </div>
                 ) : (
                   <>
                     <div>
                       <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Repository</label>
                       <select
                         className="w-full appearance-none rounded-sm border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                         style={{
                           backgroundImage:
                             "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                           backgroundRepeat: "no-repeat",
                           backgroundPosition: "right 16px center",
                           backgroundSize: "12px 12px"
                         }}
                         value={githubRepoId}
                         onChange={(event) => setGithubRepoId(event.target.value)}
                       >
                         {githubRepos.map((repo) => (
                           <option key={repo.id} value={repo.id}>
                             {repo.fullName}
                           </option>
                         ))}
                       </select>
                     </div>

                     <div>
                       <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Title</label>
                       <input
                         className="w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                         value={githubIssueTitle}
                         onChange={(event) => setGithubIssueTitle(event.target.value)}
                         placeholder="Issue title"
                       />
                     </div>

                     <div>
                       <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Description</label>
                       <textarea
                         className="w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 min-h-[180px]"
                         value={githubIssueBody}
                         onChange={(event) => setGithubIssueBody(event.target.value)}
                       />
                     </div>
                   </>
                 )}

                 {githubModalError ? (
                   <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                     {githubModalError}
                   </div>
                 ) : null}
               </div>
            </div>

            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-4 border-t border-border/50 shrink-0">
               <button 
                 onClick={createGithubIssueForTarget} 
                 disabled={
                   githubReposLoading ||
                   !githubConnected ||
                   !githubRepos.length ||
                   !githubRepoId ||
                   creatingGithubIssueId === githubIssueTarget.id
                 }
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={creatingGithubIssueId === githubIssueTarget.id} loadingLabel="Creating..." idleLabel="Create issue" icon={Github} />
               </button>
               <button 
                 onClick={() => setGithubIssueTarget(null)} 
                 disabled={creatingGithubIssueId === githubIssueTarget.id}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
