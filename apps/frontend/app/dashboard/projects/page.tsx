"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, Archive, Trash2, X } from "lucide-react";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";
const projectsPrefsKey = "traceforge_projects_prefs_v1";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  apiKey: string | null;
  aiModel: string;
  githubRepoId?: string | null;
  githubRepoName?: string | null;
  githubRepoUrl?: string | null;
  createdAt: string;
  orgId?: string | null;
  archivedAt?: string | null;
  configuredAt?: string | null;
  lastConfiguredAt?: string | null;
  telemetryStatus: "configured" | "not_configured";
  configurationSource: "handshake" | "legacy_telemetry" | "stale" | "pending";
  lastEventAt?: string | null;
  eventCount: number;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

type AiModelOption = {
  id: string;
  label: string;
  description: string;
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

const PROJECT_PAGE_SIZE_OPTIONS = [
  { value: 6, label: "6 / page" },
  { value: 12, label: "12 / page" },
  { value: 18, label: "18 / page" }
];

const getProjectStatusMeta = (project: Project) =>
  project.telemetryStatus === "configured"
    ? {
        label: "Configured",
        className: "tf-success-tag"
      }
    : {
        label: "Not configured",
        className: "tf-warning-tag"
      };

export default function ProjectSettingsPage() {
  const orgPrefsHydratedRef = useRef(false);
  const pagePrefsHydratedRef = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Project | null>(null);
  const [permanentDeleteInput, setPermanentDeleteInput] = useState("");
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [revealedProjectId, setRevealedProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [availableAiModels, setAvailableAiModels] = useState<AiModelOption[]>([]);
  const [defaultAiModel, setDefaultAiModel] = useState("groq/compound");
  const [newProjectAiModel, setNewProjectAiModel] = useState("groq/compound");
  const [availableGithubRepos, setAvailableGithubRepos] = useState<GithubRepo[]>([]);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [newProjectGithubRepoId, setNewProjectGithubRepoId] = useState("");
  const [updatingGithubRepoProjectId, setUpdatingGithubRepoProjectId] = useState<string | null>(null);
  const [updatingAiModelProjectId, setUpdatingAiModelProjectId] = useState<string | null>(null);
  const [activeProjectsPage, setActiveProjectsPage] = useState(1);
  const [activeProjectsPageSize, setActiveProjectsPageSize] = useState(6);
  const [archivedProjectsPage, setArchivedProjectsPage] = useState(1);
  const [archivedProjectsPageSize, setArchivedProjectsPageSize] = useState(6);
  const [dragOverOrgId, setDragOverOrgId] = useState<string | null>(null);
  const [isMovingProject, setIsMovingProject] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [bulkActionInput, setBulkActionInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pageRaw = window.localStorage.getItem(projectsPrefsKey);
      if (pageRaw) {
        const pagePrefs = JSON.parse(pageRaw) as {
          orgId?: string;
          showArchived?: boolean;
          activePageSize?: number;
          archivedPageSize?: number;
        };
        if (typeof pagePrefs.orgId === "string") {
          setSelectedOrgId(pagePrefs.orgId);
        }
        if (typeof pagePrefs.showArchived === "boolean") setShowArchived(pagePrefs.showArchived);
        if (typeof pagePrefs.activePageSize === "number" && pagePrefs.activePageSize > 0) {
          setActiveProjectsPageSize(pagePrefs.activePageSize);
        }
        if (typeof pagePrefs.archivedPageSize === "number" && pagePrefs.archivedPageSize > 0) {
          setArchivedProjectsPageSize(pagePrefs.archivedPageSize);
        }
      }

      const raw = window.localStorage.getItem(dashboardPrefsKey);
      if (!raw || pageRaw) return;
      const prefs = JSON.parse(raw) as { orgId?: string };
      if (typeof prefs.orgId === "string") {
        setSelectedOrgId(prefs.orgId);
      }
    } catch {
      // Ignore malformed prefs.
    } finally {
      orgPrefsHydratedRef.current = true;
      pagePrefsHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !orgPrefsHydratedRef.current) return;
    try {
      const raw = window.localStorage.getItem(dashboardPrefsKey);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(
        dashboardPrefsKey,
        JSON.stringify({
          ...existing,
          orgId: selectedOrgId
        })
      );
    } catch {
      // Ignore persistence errors.
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (typeof window === "undefined" || !pagePrefsHydratedRef.current) return;
    window.localStorage.setItem(
      projectsPrefsKey,
      JSON.stringify({
        orgId: selectedOrgId,
        showArchived,
        activePageSize: activeProjectsPageSize,
        archivedPageSize: archivedProjectsPageSize
      })
    );
  }, [selectedOrgId, showArchived, activeProjectsPageSize, archivedProjectsPageSize]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  const fetchProjectApiKey = async (projectId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      throw new Error("Missing auth token. Please log in again.");
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/api-key`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.apiKey !== "string") {
      throw new Error(data.error || "Failed to load API key");
    }

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              apiKey: data.apiKey
            }
          : project
      )
    );

    return data.apiKey as string;
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const loadProjects = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectsRes, orgsRes] = await Promise.all([
        fetch(`${API_URL}/projects?includeArchived=${showArchived ? "true" : "false"}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/orgs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [projectsData, orgsData] = await Promise.all([
        projectsRes.json(),
        orgsRes.json().catch(() => ({}))
      ]);

      if (!projectsRes.ok) {
        throw new Error(projectsData.error || "Failed to load projects");
      }

      setProjects(projectsData.projects || []);
      setAvailableAiModels(projectsData.availableAiModels || []);
      setDefaultAiModel(projectsData.defaultAiModel || "groq/compound");
      setNewProjectAiModel(projectsData.defaultAiModel || "groq/compound");
      if (orgsRes.ok) {
        setOrgs(orgsData.orgs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const loadGithubRepos = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/integrations/github`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as GithubIntegrationState;
      if (!res.ok) {
        throw new Error(data.error || "Failed to load GitHub repositories");
      }

      setGithubConfigured(Boolean(data.configured));
      setGithubConnected(Boolean(data.connected));
      const selectedRepos = (data.repos || []).filter((repo) =>
        (data.selectedRepoIds || []).includes(repo.id)
      );
      setAvailableGithubRepos(selectedRepos);
    } catch (err) {
      setGithubConfigured(false);
      setGithubConnected(false);
      setAvailableGithubRepos([]);
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  useEffect(() => {
    loadProjects();
    void loadGithubRepos();
  }, [showArchived]);

  const rotateKey = async (projectId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/rotate-key`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate key");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      showToast("API key rotated", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const archiveProject = async (projectId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: deleteInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive project");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      setDeleteTarget(null);
      setDeleteInput("");
      showToast("Project archived", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const restoreProject = async (projectId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore project");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      showToast("Project restored", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const renameProject = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !renameTarget) return;

    if (!renameInput.trim()) {
      setError("Project name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${renameTarget.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: renameInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rename project");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === renameTarget.id ? data.project : project))
      );
      setRenameTarget(null);
      setRenameInput("");
      showToast("Project renamed", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const moveProject = async (projectId: string, targetOrgId: string | null) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setIsMovingProject(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orgId: targetOrgId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to move project");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      showToast("Project moved successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsMovingProject(false);
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleBulkArchiveProjects = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || selectedProjectIds.size === 0) return;

    setLoading(true);
    try {
      const ids = Array.from(selectedProjectIds);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`${API_URL}/projects/${id}`, {
            method: "DELETE",
            headers: { 
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: "delete all" })
          })
        )
      );

      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        showToast(`Failed to archive ${failedCount} projects`, "error");
      } else {
        showToast(`Archived ${ids.length} projects`, "success");
        setSelectedProjectIds(new Set());
      }
      await loadProjects();
    } catch (err) {
      showToast("Bulk archiving failed", "error");
    } finally {
      setLoading(false);
      setShowBulkArchiveModal(false);
      setBulkActionInput("");
    }
  };

  const deleteProjectPermanently = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !permanentDeleteTarget) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${permanentDeleteTarget.id}/permanent`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: permanentDeleteInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete project");
      }

      setProjects((prev) => prev.filter((project) => project.id !== permanentDeleteTarget.id));
      setPermanentDeleteTarget(null);
      setPermanentDeleteInput("");
      showToast("Project deleted permanently", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = async (project: Project) => {
    try {
      const apiKey = project.apiKey ?? (await fetchProjectApiKey(project.id));
      await navigator.clipboard.writeText(apiKey);
      showToast("API key copied", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to copy API key", "error");
    }
  };

  const toggleRevealProjectKey = async (project: Project) => {
    if (revealedProjectId === project.id) {
      setRevealedProjectId(null);
      return;
    }

    try {
      if (!project.apiKey) {
        await fetchProjectApiKey(project.id);
      }
      setRevealedProjectId(project.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reveal API key", "error");
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

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newProjectName,
          orgId: selectedOrgId || undefined,
          aiModel: newProjectAiModel || defaultAiModel,
          githubRepoId: newProjectGithubRepoId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjects((prev) => [data.project, ...prev]);
      setNewProjectName("");
      setNewProjectAiModel(defaultAiModel);
      setNewProjectGithubRepoId("");
      setShowCreateModal(false);
      showToast("Project created", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const updateProjectAiModel = async (projectId: string, aiModel: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setUpdatingAiModelProjectId(projectId);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/ai-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ aiModel })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update AI model");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      showToast("AI model updated", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      await loadProjects();
    } finally {
      setUpdatingAiModelProjectId(null);
    }
  };

  const updateProjectGithubRepo = async (projectId: string, githubRepoId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setUpdatingGithubRepoProjectId(projectId);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/github-repo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ githubRepoId: githubRepoId || null })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update GitHub repository");
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? data.project : project))
      );
      showToast(githubRepoId ? "GitHub repo linked" : "GitHub repo removed", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      await loadProjects();
    } finally {
      setUpdatingGithubRepoProjectId(null);
    }
  };

  const scopedProjects = selectedOrgId
    ? projects.filter((project) => project.orgId === selectedOrgId)
    : projects.filter((project) => !project.orgId);
  const activeProjects = scopedProjects.filter((project) => !project.archivedAt);
  const archivedProjects = scopedProjects.filter((project) => project.archivedAt);
  const activeProjectsTotalPages = Math.max(
    1,
    Math.ceil(activeProjects.length / activeProjectsPageSize)
  );
  const archivedProjectsTotalPages = Math.max(
    1,
    Math.ceil(archivedProjects.length / archivedProjectsPageSize)
  );
  const paginatedActiveProjects = useMemo(() => {
    const start = (activeProjectsPage - 1) * activeProjectsPageSize;
    return activeProjects.slice(start, start + activeProjectsPageSize);
  }, [activeProjects, activeProjectsPage, activeProjectsPageSize]);
  const paginatedArchivedProjects = useMemo(() => {
    const start = (archivedProjectsPage - 1) * archivedProjectsPageSize;
    return archivedProjects.slice(start, start + archivedProjectsPageSize);
  }, [archivedProjects, archivedProjectsPage, archivedProjectsPageSize]);

  useEffect(() => {
    setActiveProjectsPage(1);
    setArchivedProjectsPage(1);
  }, [selectedOrgId, showArchived]);

  useEffect(() => {
    setActiveProjectsPage((current) => Math.min(current, activeProjectsTotalPages));
  }, [activeProjectsTotalPages]);

  useEffect(() => {
    setArchivedProjectsPage((current) => Math.min(current, archivedProjectsTotalPages));
  }, [archivedProjectsTotalPages]);

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="mt-2 flex flex-col gap-4">
          <div>
            <p className="tf-kicker">Projects</p>
            <div className="mt-2 flex items-center">
              <h1 className="font-display text-2xl font-semibold text-text-primary">
                Manage Projects
              </h1>
              <PageDescriptionPopover>
                Rotate keys and archive projects you no longer need.
                <br /><br />
                Projects stay configured while recent setup or telemetry signals are still being received.
              </PageDescriptionPopover>
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
            <div 
              className="flex flex-1 flex-nowrap items-center gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden relative min-w-0 mask-image-fade"
              style={{ scrollbarWidth: 'none', WebkitMaskImage: 'linear-gradient(to right, black 95%, transparent)' }}
              onDragOver={(e) => {
                const container = e.currentTarget;
                const scrollSensitivity = 60;
                const scrollSpeed = 20;
                const rect = container.getBoundingClientRect();
                
                if (e.clientX - rect.left < scrollSensitivity) {
                  container.scrollLeft -= scrollSpeed;
                } else if (rect.right - e.clientX < scrollSensitivity) {
                  container.scrollLeft += scrollSpeed;
                }
              }}
            >
              {[{ id: "", name: "Personal" }, ...orgs].map((org) => {
                const isSelected = selectedOrgId === org.id;
                const isDragOver = dragOverOrgId === org.id;
                
                return (
                  <button
                    key={org.id}
                    className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-text-secondary border-border hover:bg-secondary/70 hover:text-text-primary"
                    } ${
                      isDragOver
                        ? "border-primary border-dashed bg-primary/10 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] scale-105"
                        : ""
                    }`}
                    onClick={() => setSelectedOrgId(org.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverOrgId(org.id);
                    }}
                    onDragLeave={() => setDragOverOrgId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverOrgId(null);
                      const projectId = e.dataTransfer.getData("projectId");
                      const sourceOrgId = e.dataTransfer.getData("sourceOrgId");
                      if (projectId && sourceOrgId !== org.id) {
                        void moveProject(projectId, org.id || null);
                      }
                    }}
                  >
                    {org.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition max-[639px]:text-[12px] max-[639px]:leading-none ${
                showArchived
                  ? "border-primary/40 bg-accent-soft text-text-primary"
                  : "border-border text-text-secondary hover:bg-secondary/70"
              }`}
              onClick={() => setShowArchived((value) => !value)}
            >
              <span className="hidden sm:inline">{showArchived ? "Hide archived" : "Show archived"}</span>
              <span className="sm:hidden">{showArchived ? "Hide archi..." : "Show archi..."}</span>
            </button>
            <button
              className="tf-button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold max-[639px]:text-[12px] max-[639px]:leading-none"
              onClick={() => setShowCreateModal(true)}
            >
              Create project
            </button>
          </div>
        </header>

        <div className="tf-divider my-6" />

        {loading && <p className="text-sm text-text-secondary">Working...</p>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedActiveProjects.map((project) => {
            const isSelected = selectedProjectIds.has(project.id);
            return (
            <div
              key={project.id}
              className={`tf-card group flex min-w-0 flex-col p-5 transition-all hover:border-primary/20 bg-card border rounded-xl shadow-sm ${
                isSelected ? "border-primary bg-primary/5" : "border-border"
              }`}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData("projectId", project.id);
                e.dataTransfer.setData("sourceOrgId", project.orgId || "");
                e.dataTransfer.effectAllowed = "move";
                
                // Create custom ghost drag image
                const dragGhost = document.createElement("div");
                dragGhost.className = "fixed top-[-1000px] left-[-1000px] z-[9999] bg-card border border-border text-text-primary px-3 py-1.5 rounded-lg shadow-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2";
                dragGhost.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg> ${project.name}`;
                document.body.appendChild(dragGhost);
                e.dataTransfer.setDragImage(dragGhost, 0, 0);
                setTimeout(() => {
                  if (document.body.contains(dragGhost)) document.body.removeChild(dragGhost);
                }, 0);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <label className="relative flex cursor-pointer items-center p-1 -ml-1 hover:bg-secondary/50 group/checkbox mt-0.5 rounded-md">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={isSelected}
                      onChange={() => toggleProjectSelection(project.id)}
                    />
                    <div className={`h-[18px] w-[18px] rounded-[4px] border-2 transition-all flex items-center justify-center ${
                      isSelected 
                        ? "border-primary bg-primary" 
                        : "border-text-secondary/50 bg-transparent group-hover/checkbox:border-text-secondary/80"
                    }`}>
                      {isSelected && (
                        <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </label>
                  <div className="cursor-grab text-text-secondary/40 hover:text-text-primary active:cursor-grabbing mt-0.5">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary leading-tight">{project.name}</h2>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {(() => {
                  const status = getProjectStatusMeta(project);
                  return (
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium tracking-wide ${status.className}`}
                    >
                      {status.label}
                    </span>
                  );
                })()}
              </div>

              {/* Body */}
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {/* Stats & API Key row */}
                <div className="flex min-w-0 items-center justify-between rounded-lg border border-border bg-secondary/10 p-3 text-xs">
                  <div className="mr-3 flex min-w-0 flex-1 flex-col">
                     <span className="text-text-secondary text-[10px] uppercase font-semibold">API Key</span>
                     <span className="font-mono text-text-primary mt-1 truncate">
                      {revealedProjectId === project.id
                        ? (project.apiKey ?? "Loading…")
                        : project.apiKey
                          ? project.apiKey.replace(/.(?=.{6})/g, "•")
                          : "Reveal to load"}
                     </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 border-l border-border/50 pl-3">
                    <button
                      className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                      onClick={() => void toggleRevealProjectKey(project)}
                    >
                      {revealedProjectId === project.id ? "Hide" : "Reveal"}
                    </button>
                    <button
                      className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                      onClick={() => void copyApiKey(project)}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase">
                      AI Model
                    </label>
                    <select
                      className="w-full bg-transparent border-b border-border/50 pb-1 text-xs text-text-primary outline-none focus:border-primary transition-colors cursor-pointer"
                      value={project.aiModel}
                      onChange={(event) => updateProjectAiModel(project.id, event.target.value)}
                      disabled={loading || updatingAiModelProjectId === project.id}
                    >
                      {availableAiModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase">
                      GitHub Repo
                    </label>
                    <select
                      className="w-full bg-transparent border-b border-border/50 pb-1 text-xs text-text-primary outline-none focus:border-primary transition-colors cursor-pointer"
                      value={project.githubRepoId || ""}
                      onChange={(event) => updateProjectGithubRepo(project.id, event.target.value)}
                      disabled={
                        loading ||
                        updatingGithubRepoProjectId === project.id ||
                        !githubConfigured ||
                        !githubConnected
                      }
                    >
                      <option value="">
                        {githubConnected ? "No repo" : "Connect GitHub"}
                      </option>
                      {availableGithubRepos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.fullName.split('/')[1] || repo.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
                <div className="flex items-center gap-4">
                  <button
                    className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                    onClick={() => {
                      setError(null);
                      setRenameTarget(project);
                      setRenameInput(project.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                    onClick={() => rotateKey(project.id)}
                    disabled={loading}
                  >
                    Rotate Key
                  </button>
                </div>
                <button
                  className="text-[11px] font-medium text-destructive hover:text-destructive/80 transition-colors"
                  onClick={() => {
                    setError(null);
                    setDeleteTarget(project);
                    setDeleteInput("");
                  }}
                  disabled={loading}
                >
                  Archive
                </button>
              </div>
            </div>
            );
          })}
          {!activeProjects.length && !loading && (
            <p className="text-sm text-text-secondary">No active projects yet.</p>
          )}
        </div>

        {activeProjects.length > 5 && (
          <DashboardPagination
            page={activeProjectsPage}
            totalPages={activeProjectsTotalPages}
            pageSize={activeProjectsPageSize}
            pageSizeOptions={PROJECT_PAGE_SIZE_OPTIONS}
            onPageChange={setActiveProjectsPage}
            onPageSizeChange={(nextSize) => {
              setActiveProjectsPage(1);
              setActiveProjectsPageSize(nextSize);
            }}
          />
        )}

        {showArchived && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="tf-section-title">Archived Projects</h3>
              <p className="text-xs text-text-secondary">
                {archivedProjects.length
                  ? `${archivedProjects.length} archived`
                  : "No archived projects"}
              </p>
            </div>
            {!!archivedProjects.length && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {paginatedArchivedProjects.map((project) => (
                  <div key={project.id} className="tf-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-text-primary">
                          {project.name}
                        </h2>
                        <p className="text-xs text-text-secondary">
                          Archived{" "}
                          {project.archivedAt
                            ? new Date(project.archivedAt).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70"
                          onClick={() => {
                            setError(null);
                            setRenameTarget(project);
                            setRenameInput(project.name);
                          }}
                          disabled={loading}
                        >
                          Rename
                        </button>
                        <button
                          className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70"
                          onClick={() => restoreProject(project.id)}
                          disabled={loading}
                        >
                          Restore
                        </button>
                        <button
                          className="tf-danger-button rounded-full border px-3 py-1 text-[11px] font-semibold transition"
                          onClick={() => {
                            setError(null);
                            setPermanentDeleteTarget(project);
                            setPermanentDeleteInput("");
                          }}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
                {archivedProjects.length > 5 && (
                  <DashboardPagination
                    page={archivedProjectsPage}
                    totalPages={archivedProjectsTotalPages}
                    pageSize={archivedProjectsPageSize}
                    pageSizeOptions={PROJECT_PAGE_SIZE_OPTIONS}
                    onPageChange={setArchivedProjectsPage}
                    onPageSizeChange={(nextSize) => {
                      setArchivedProjectsPage(1);
                      setArchivedProjectsPageSize(nextSize);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg max-h-[70vh] sm:max-h-[90vh] rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Create Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
               <p className="text-sm text-text-secondary mb-6">Add a new project to start tracking errors immediately.</p>
               
               <div className="space-y-5">
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     Project name
                   </label>
                   <input
                     className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                     placeholder="e.g. Frontend App"
                     value={newProjectName}
                     onChange={(event) => setNewProjectName(event.target.value)}
                     autoFocus
                   />
                 </div>
                 
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     AI model
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
                     value={newProjectAiModel}
                     onChange={(event) => setNewProjectAiModel(event.target.value)}
                   >
                     {availableAiModels.map((model) => (
                       <option key={model.id} value={model.id}>
                         {model.label}
                       </option>
                     ))}
                   </select>
                 </div>
  
                 <div>
                   <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                     GitHub repo
                   </label>
                   <select
                     className="w-full appearance-none rounded-xl border border-border bg-secondary/20 px-4 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                     {availableGithubRepos.map((repo) => (
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
                 disabled={loading || !newProjectName.trim()}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={loading} loadingLabel="Creating..." idleLabel="Create Project" />
               </button>
               <button 
                 onClick={() => setShowCreateModal(false)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Rename Project</h3>
              <button onClick={() => {
                  setRenameTarget(null);
                  setRenameInput("");
                }} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <p className="text-sm text-text-secondary mb-4">Update the project name everywhere it appears in the dashboard.</p>
               <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                 Project name
               </label>
               <input
                 className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                 placeholder="Project name"
                 value={renameInput}
                 onChange={(event) => setRenameInput(event.target.value)}
                 autoFocus
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={renameProject} 
                 disabled={loading || !renameInput.trim()}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={loading} loadingLabel="Saving..." idleLabel="Save name" />
               </button>
               <button 
                 onClick={() => {
                   setRenameTarget(null);
                   setRenameInput("");
                 }} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-sm font-semibold text-text-primary">Archive Project</h3>
                <button onClick={() => setDeleteTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="p-6">
                 <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to archive this project?</h4>
                 <p className="text-sm text-text-secondary">
                   Archived projects are hidden and stop ingesting new data. You can restore it later. Type <span className="font-semibold">{deleteTarget.name}</span> to confirm.
                 </p>
                 <input
                   className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                   placeholder={deleteTarget.name}
                   value={deleteInput}
                   onChange={(e) => setDeleteInput(e.target.value)}
                   disabled={loading}
                 />
              </div>
              
              <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
                 <button 
                   onClick={() => archiveProject(deleteTarget.id)} 
                   disabled={loading || deleteInput !== deleteTarget.name}
                   className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
                 >
                   Archive
                 </button>
                 <button 
                   onClick={() => setDeleteTarget(null)} 
                   disabled={loading}
                   className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                 >
                   Cancel
                 </button>
              </div>
            </div>
          </div>
        )}

      {permanentDeleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-sm font-semibold text-text-primary">Delete Project</h3>
                <button onClick={() => {
                    setPermanentDeleteTarget(null);
                    setPermanentDeleteInput("");
                  }} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="p-6">
                 <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to delete this project?</h4>
                 <p className="text-sm text-text-secondary">
                   This action is permanent and cannot be undone. Type <span className="font-semibold">{permanentDeleteTarget.name}</span> to confirm.
                 </p>
                 <input
                   className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                   placeholder={permanentDeleteTarget.name}
                   value={permanentDeleteInput}
                   onChange={(e) => setPermanentDeleteInput(e.target.value)}
                   disabled={loading}
                 />
              </div>
              
              <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
                 <button 
                   onClick={deleteProjectPermanently} 
                   disabled={loading || permanentDeleteInput !== permanentDeleteTarget.name}
                   className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
                 >
                   Delete
                 </button>
                 <button 
                   onClick={() => {
                     setPermanentDeleteTarget(null);
                     setPermanentDeleteInput("");
                   }} 
                   disabled={loading}
                   className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                 >
                   Cancel
                 </button>
              </div>
            </div>
          </div>
        )}

      {selectedProjectIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex w-max max-w-[95vw] items-center gap-2 sm:gap-4 rounded-full border border-border/80 bg-card/95 px-3 py-2 sm:px-4 sm:py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] sm:text-xs font-bold text-primary">
              {selectedProjectIds.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-text-primary hidden sm:inline">selected</span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              className="rounded-full px-2 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-text-secondary hover:bg-secondary/80 hover:text-text-primary transition-colors whitespace-nowrap"
              onClick={() => setSelectedProjectIds(new Set())}
            >
              Deselect all
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-destructive-soft border border-destructive-border px-2 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 whitespace-nowrap"
              onClick={() => setShowBulkArchiveModal(true)}
            >
              <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              Archive all
            </button>
          </div>
        </div>
      )}

      {showBulkArchiveModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Archive Projects</h3>
              <button onClick={() => setShowBulkArchiveModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to archive these projects?</h4>
               <p className="text-sm text-text-secondary">
                 You can still view archived projects. Type <span className="font-semibold">Archive projects</span> to confirm.
               </p>
               <input
                 className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                 placeholder="Archive projects"
                 value={bulkActionInput}
                 onChange={(e) => setBulkActionInput(e.target.value)}
                 disabled={loading}
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={handleBulkArchiveProjects} 
                 disabled={loading || bulkActionInput !== "Archive projects"}
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Archive
               </button>
               <button 
                 onClick={() => setShowBulkArchiveModal(false)} 
                 disabled={loading}
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
          className="tf-dashboard-toast"
          style={{
            background: toast.tone === "success" ? "#16a34a" : "#dc2626",
            color: "white"
          }}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
