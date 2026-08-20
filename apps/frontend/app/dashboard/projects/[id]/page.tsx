"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

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

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const projectId = params.id;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  
  const [availableAiModels, setAvailableAiModels] = useState<AiModelOption[]>([]);
  const [availableGithubRepos, setAvailableGithubRepos] = useState<GithubRepo[]>([]);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  
  const [updatingAiModel, setUpdatingAiModel] = useState(false);
  const [updatingGithubRepo, setUpdatingGithubRepo] = useState(false);
  
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchProjectDetails = async () => {
    try {
      const token = window.localStorage.getItem(tokenKey);
      if (!token) return;

      setLoading(true);
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch project");
      setProject(data.project);
      setRenameInput(data.project.name);
      setAvailableAiModels(data.availableAiModels || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const token = window.localStorage.getItem(tokenKey);
      if (!token) return;

      const githubRes = await fetch(`${API_URL}/integrations/github`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (githubRes.ok) {
        const data = await githubRes.json();
        const selectedRepos = (data.repos || []).filter((repo: GithubRepo) =>
          (data.selectedRepoIds || []).includes(repo.id)
        );
        setAvailableGithubRepos(selectedRepos);
        setGithubConfigured(data.configured);
        setGithubConnected(data.connected);
      }
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchIntegrations();
  }, [projectId]);

  const handleUpdateAiModel = async (modelId: string) => {
    if (!project) return;
    setUpdatingAiModel(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}/ai-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ aiModel: modelId })
      });
      if (!res.ok) throw new Error("Failed to update AI model");
      setProject({ ...project, aiModel: modelId });
      setToast({ message: "AI Model updated successfully", tone: "success" });
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
    } finally {
      setUpdatingAiModel(false);
    }
  };

  const handleUpdateGithubRepo = async (repoId: string) => {
    if (!project) return;
    setUpdatingGithubRepo(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}/github-repo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ githubRepoId: repoId })
      });
      if (!res.ok) throw new Error("Failed to update GitHub repo");
      
      const selectedRepo = availableGithubRepos.find((r) => r.id === repoId);
      setProject({
        ...project,
        githubRepoId: repoId || null,
        githubRepoName: selectedRepo ? selectedRepo.fullName : null,
        githubRepoUrl: selectedRepo ? selectedRepo.url : null
      });
      setToast({ message: "GitHub repository updated", tone: "success" });
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
    } finally {
      setUpdatingGithubRepo(false);
    }
  };

  const handleRename = async () => {
    if (!project || !renameInput.trim() || renameInput === project.name) return;
    setIsRenaming(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: renameInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename project");
      setProject({ ...project, name: data.project.name });
      setToast({ message: "Project renamed successfully", tone: "success" });
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRotateKey = async () => {
    if (!project) return;
    if (!window.confirm("Are you sure you want to rotate the API key? The old key will stop working immediately.")) return;
    
    setIsRotatingKey(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rotate key");
      setProject({ ...project, apiKey: data.apiKey });
      setToast({ message: "API key rotated successfully", tone: "success" });
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
    } finally {
      setIsRotatingKey(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    if (!window.confirm("Are you sure you want to archive this project?")) return;
    
    setIsArchiving(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to archive project");
      setToast({ message: "Project archived", tone: "success" });
      router.push("/dashboard/projects");
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || deleteInput !== project.name) return;
    setIsDeleting(true);
    try {
      const token = window.localStorage.getItem(tokenKey);
      const res = await fetch(`${API_URL}/projects/${project.id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete project");
      setToast({ message: "Project permanently deleted", tone: "success" });
      router.push("/dashboard/projects");
    } catch (err: any) {
      setToast({ message: err.message, tone: "error" });
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-text-secondary">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error || "Project not found"}</p>
        <button 
          onClick={() => router.push("/dashboard/projects")}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-12 space-y-8">
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.tone === "error"
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link 
          href="/dashboard/projects" 
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{project.name}</h1>
          <p className="text-[14px] text-text-secondary mt-1">
            Created on {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-8">
        
        {/* Integrations Card */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
            Integrations & Settings
          </h2>
          <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-sm p-6 sm:p-8 flex flex-col gap-8">
          
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                AI Model
              </label>
              <select
                className="w-full rounded-md border border-border bg-secondary/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                value={project.aiModel}
                onChange={(e) => handleUpdateAiModel(e.target.value)}
                disabled={updatingAiModel}
              >
                {availableAiModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="text-[12px] text-text-secondary/60 mt-1">
                The model used to analyze errors for this project.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                GitHub Repository
              </label>
              <select
                className="w-full rounded-md border border-border bg-secondary/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                value={project.githubRepoId || ""}
                onChange={(e) => handleUpdateGithubRepo(e.target.value)}
                disabled={updatingGithubRepo || !githubConfigured || !githubConnected}
              >
                <option value="">
                  {githubConnected ? "No repository connected" : "Connect GitHub first"}
                </option>
                {availableGithubRepos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
              <p className="text-[12px] text-text-secondary/60 mt-1">
                Link a repository to enable source code context in analysis.
              </p>
            </div>
          </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="mb-4 mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-destructive">
            Danger Zone
          </h2>
          <div className="overflow-hidden rounded-[24px] border border-destructive/20 bg-destructive/5 shadow-sm p-6 sm:p-8 flex flex-col gap-6">
          
          <div className="grid gap-6">
            {/* Rename */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border/10">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-medium text-text-primary">Rename Project</span>
                <span className="text-[12px] text-text-secondary">Change the display name of this project.</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 w-48"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder="New name"
                />
                <button
                  className="rounded-md bg-secondary/50 hover:bg-secondary/80 px-4 py-2 text-sm font-medium text-text-primary transition-colors disabled:opacity-50"
                  onClick={handleRename}
                  disabled={isRenaming || !renameInput.trim() || renameInput === project.name}
                >
                  <LoadingButtonContent loading={isRenaming} loadingLabel="Renaming..." idleLabel="Rename" />
                </button>
              </div>
            </div>
            </div>

            {/* Rotate Key */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border/10">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-medium text-text-primary">Rotate API Key</span>
                <span className="text-[12px] text-text-secondary">Invalidate the current key and generate a new one.</span>
              </div>
              <button
                className="rounded-md bg-secondary/50 hover:bg-secondary/80 px-4 py-2 text-sm font-medium text-text-primary transition-colors"
                onClick={handleRotateKey}
                disabled={isRotatingKey}
              >
                <LoadingButtonContent loading={isRotatingKey} loadingLabel="Rotating..." idleLabel="Rotate Key" />
              </button>
            </div>

            {/* Archive */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border/10">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-medium text-text-primary">Archive Project</span>
                <span className="text-[12px] text-text-secondary">Hide this project from the active list. It can be restored later.</span>
              </div>
              <button
                className="rounded-md border border-destructive/20 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm font-medium transition-colors"
                onClick={handleArchive}
                disabled={isArchiving}
              >
                <LoadingButtonContent loading={isArchiving} loadingLabel="Archiving..." idleLabel="Archive" />
              </button>
            </div>

            {/* Delete */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
              <div className="flex flex-col gap-1 max-w-sm">
                <span className="text-[14px] font-medium text-destructive">Delete Project</span>
                <span className="text-[12px] text-text-secondary">Permanently delete this project and all its data. Type <strong className="text-text-primary">{project.name}</strong> to confirm.</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  className="rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 w-48"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder={project.name}
                />
                <button
                  className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={handleDelete}
                  disabled={isDeleting || deleteInput !== project.name}
                >
                  <LoadingButtonContent loading={isDeleting} loadingLabel="Deleting..." idleLabel="Delete" />
                </button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}
