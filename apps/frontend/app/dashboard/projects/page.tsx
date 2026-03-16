"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  archivedAt?: string | null;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

export default function ProjectSettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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
      const res = await fetch(
        `${API_URL}/projects?includeArchived=${showArchived ? "true" : "false"}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load projects");
      }

      setProjects(data.projects || []);
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

  const activeProjects = projects.filter((project) => !project.archivedAt);
  const archivedProjects = projects.filter((project) => project.archivedAt);

  return (
    <main className="tf-page">
      <div className="relative mx-auto max-w-4xl">
        <Link className="tf-link" href="/dashboard">
          ← Back to dashboard
        </Link>
        <header className="mt-4">
          <p className="tf-kicker">Project Settings</p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-ink">
            Manage Projects
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Rotate API keys or archive projects you no longer need.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input
              id="showArchived"
              type="checkbox"
              className="h-4 w-4 accent-[#d2a45f]"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <label htmlFor="showArchived">Show archived projects</label>
          </div>
        </header>

        <div className="tf-divider my-6" />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Working...</p>}

        <div className="space-y-4">
          {activeProjects.map((project) => (
            <div key={project.id} className="tf-card p-6">
              <div className="tf-row">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                  <p className="text-xs text-slate-500">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="tf-pill"
                    onClick={() => rotateKey(project.id)}
                    disabled={loading}
                  >
                    Rotate Key
                  </button>
                  <button
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50"
                    onClick={() => {
                      setError(null);
                      setDeleteTarget(project);
                      setDeleteInput("");
                    }}
                    disabled={loading}
                  >
                    Archive Project
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-500">API Key</p>
                    <p className="mt-1 break-all">{project.apiKey}</p>
                  </div>
                  <button className="tf-pill" onClick={() => copyApiKey(project.apiKey)}>
                    Copy
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  Ingestion endpoint: {API_URL}/ingest
                </p>
              </div>
            </div>
          ))}
          {!activeProjects.length && !loading && (
            <p className="text-sm text-slate-500">No active projects yet.</p>
          )}
        </div>

        {showArchived && archivedProjects.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="tf-section-title">Archived Projects</h3>
            {archivedProjects.map((project) => (
              <div key={project.id} className="tf-card p-6">
                <div className="tf-row">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                    <p className="text-xs text-slate-500">
                      Archived{" "}
                      {project.archivedAt
                        ? new Date(project.archivedAt).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <button
                    className="tf-pill"
                    onClick={() => restoreProject(project.id)}
                    disabled={loading}
                  >
                    Restore Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur">
              <h3 className="font-display text-lg font-semibold text-ink">Archive Project</h3>
              <p className="mt-2 text-sm text-slate-600">
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
                  className="tf-button-ghost"
                  onClick={() => setDeleteTarget(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
