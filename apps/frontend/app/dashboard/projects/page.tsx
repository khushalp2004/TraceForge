"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  apiKey: string;
  aiModel: string;
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

const getProjectStatusMeta = (project: Project) =>
  project.telemetryStatus === "configured"
    ? {
        label: "Configured",
        className:
          "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      }
    : {
        label: "Not configured",
        className:
          "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300"
      };

export default function ProjectSettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [revealedProjectId, setRevealedProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [availableAiModels, setAvailableAiModels] = useState<AiModelOption[]>([]);
  const [defaultAiModel, setDefaultAiModel] = useState("groq/compound");
  const [newProjectAiModel, setNewProjectAiModel] = useState("groq/compound");
  const [updatingAiModelProjectId, setUpdatingAiModelProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(dashboardPrefsKey);
      if (!raw) return;
      const prefs = JSON.parse(raw) as { orgId?: string };
      if (typeof prefs.orgId === "string") {
        setSelectedOrgId(prefs.orgId);
      }
    } catch {
      // Ignore malformed prefs.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

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

  useEffect(() => {
    loadProjects();
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
      showToast("Failed to rotate key", "error");
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
      showToast("Failed to archive project", "error");
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
      showToast("Failed to restore project", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      showToast("API key copied", "success");
    } catch {
      showToast("Failed to copy API key", "error");
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
          aiModel: newProjectAiModel || defaultAiModel
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjects((prev) => [data.project, ...prev]);
      setNewProjectName("");
      setNewProjectAiModel(defaultAiModel);
      setShowCreateModal(false);
      showToast("Project created", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      showToast("Failed to create project", "error");
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
      showToast("Failed to update AI model", "error");
      await loadProjects();
    } finally {
      setUpdatingAiModelProjectId(null);
    }
  };

  const scopedProjects = selectedOrgId
    ? projects.filter((project) => project.orgId === selectedOrgId)
    : projects.filter((project) => !project.orgId);
  const activeProjects = scopedProjects.filter((project) => !project.archivedAt);
  const archivedProjects = scopedProjects.filter((project) => project.archivedAt);

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Projects</p>
            <h1 className="font-display mt-2 text-2xl font-semibold text-text-primary">
              Manage Projects
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Rotate keys and archive projects you no longer need.
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Projects stay configured while recent setup or telemetry signals are still being received.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-text-secondary">
              <span>Org</span>
              <select
                className="bg-transparent text-xs font-semibold text-text-primary outline-none"
                value={selectedOrgId}
                onChange={(event) => setSelectedOrgId(event.target.value)}
                aria-label="Select organization scope"
              >
                <option value="">Personal</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                showArchived
                  ? "border-primary/40 bg-accent-soft text-text-primary"
                  : "border-border text-text-secondary hover:bg-secondary/70"
              }`}
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
            <button
              className="tf-button px-4 py-2 text-sm"
              onClick={() => setShowCreateModal(true)}
            >
              Create project
            </button>
          </div>
        </header>

        <div className="tf-divider my-6" />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-text-secondary">Working...</p>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeProjects.map((project) => (
            <div key={project.id} className="tf-card p-5">
              {(() => {
                const status = getProjectStatusMeta(project);
                return (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      {project.lastConfiguredAt
                        ? project.telemetryStatus === "configured"
                          ? project.configurationSource === "legacy_telemetry"
                            ? `Legacy activity ${new Date(project.lastConfiguredAt).toLocaleDateString()}`
                            : `Detected ${new Date(project.lastConfiguredAt).toLocaleDateString()}`
                          : `Last detected ${new Date(project.lastConfiguredAt).toLocaleDateString()}`
                        : "Waiting for setup handshake"}
                    </span>
                  </div>
                );
              })()}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">{project.name}</h2>
                  <p className="text-xs text-text-secondary">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-text-secondary"
                  onClick={() =>
                    setRevealedProjectId(
                      revealedProjectId === project.id ? null : project.id
                    )
                  }
                >
                  {revealedProjectId === project.id ? "Hide key" : "Reveal key"}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-card/70 px-3 py-3 text-xs text-text-secondary">
                <p className="font-semibold text-text-secondary">API Key</p>
                <p className="mt-1 break-all">
                  {revealedProjectId === project.id
                    ? project.apiKey
                    : project.apiKey.replace(/.(?=.{6})/g, "•")}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1">
                  {project.eventCount} {project.eventCount === 1 ? "issue group" : "issue groups"}
                </span>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-card/70 px-3 py-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    AI model
                  </span>
                  <select
                    className="tf-select mt-2 w-full"
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
                </label>
                <p className="mt-2 text-xs text-text-secondary">
                  {availableAiModels.find((model) => model.id === project.aiModel)?.description ||
                    "Choose the AI model used for solutions in this project."}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="tf-pill" onClick={() => copyApiKey(project.apiKey)}>
                  Copy
                </button>
                <button
                  className="tf-pill"
                  onClick={() => rotateKey(project.id)}
                  disabled={loading}
                >
                  Rotate Key
                </button>
                <button
                  className="tf-danger-button rounded-full border px-3 py-1 text-xs font-semibold transition"
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
          ))}
          {!activeProjects.length && !loading && (
            <p className="text-sm text-text-secondary">No active projects yet.</p>
          )}
        </div>

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
              <div className="grid gap-3 sm:grid-cols-2">
                {archivedProjects.map((project) => (
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
                      <button
                        className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70"
                        onClick={() => restoreProject(project.id)}
                        disabled={loading}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Create Project
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Add a new project to start tracking errors immediately.
            </p>
            <input
              className="tf-input mt-4 w-full"
              placeholder="Project name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
            />
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                AI model
              </span>
              <select
                className="tf-select mt-2 w-full"
                value={newProjectAiModel}
                onChange={(event) => setNewProjectAiModel(event.target.value)}
              >
                {availableAiModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-text-secondary">
                {availableAiModels.find((model) => model.id === newProjectAiModel)?.description ||
                  "Choose the default AI model for this project."}
              </p>
            </label>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                className="tf-button-ghost"
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="tf-button px-4 py-2 text-sm font-semibold"
                onClick={createProject}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
              <h3 className="font-display text-lg font-semibold text-text-primary">Archive Project</h3>
              <p className="mt-2 text-sm text-text-secondary">
                This will archive <span className="font-semibold">{deleteTarget.name}</span> and stop
                new ingestion. Type the project name to confirm.
              </p>
              <input
                className="tf-input mt-4 w-full"
                placeholder="Project name"
                value={deleteInput}
                onChange={(event) => setDeleteInput(event.target.value)}
              />
              {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70"
                  onClick={() => setDeleteTarget(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="tf-danger-solid rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                  onClick={() => archiveProject(deleteTarget.id)}
                  disabled={loading || deleteInput.trim() !== deleteTarget.name}
                >
                  {loading ? "Archiving..." : "Archive Project"}
                </button>
              </div>
            </div>
          </div>
        )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
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
