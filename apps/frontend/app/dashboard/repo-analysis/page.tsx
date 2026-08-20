"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { X } from "lucide-react";
import { DashboardPagination } from "../components/DashboardPagination";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";
import { RepoGraphViewer } from "../components/RepoGraphViewer";
import { SystemDesignViewer } from "../components/SystemDesignViewer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
};

type Project = {
  id: string;
  name: string;
  aiModel: string;
  orgId?: string | null;
  archivedAt?: string | null;
  githubRepoId?: string | null;
  githubRepoName?: string | null;
  githubRepoUrl?: string | null;
  githubRepoAnalysis?: {
    status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    summary?: string | null;
    generatedAt?: string | null;
    lastError?: string | null;
    updatedAt?: string | null;
  } | null;
};

type Report = {
  status: "UNINITIALIZED" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  graphStatus?: "UNINITIALIZED" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  systemDesignStatus?: "UNINITIALIZED" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  model?: string | null;
  summary?: string | null;
  architecture?: string | null;
  runtimeFlow?: string | null;
  developmentFlow?: string | null;
  techStack?: string[];
  keyModules?: string[];
  entryPoints?: string[];
  risks?: string[];
  onboardingTips?: string[];
  folderTree?: { path: string; type: "blob" | "tree"; size?: number }[];
  systemDesign?: any[];
  lastError?: string | null;
  generatedAt?: string | null;
  updatedAt?: string | null;
};

type AnalysisDetailResponse = {
  analysisCost: number;
  project: {
    id: string;
    name: string;
    githubRepoId?: string | null;
    githubRepoName?: string | null;
    githubRepoUrl?: string | null;
  };
  analysis: Report | null;
};

type AiModelOption = {
  id: string;
  label: string;
  description: string;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

const statusMeta = {
  READY: { label: "Ready", className: "tf-success-tag" },
  PROCESSING: { label: "Processing", className: "tf-warning-tag" },
  PENDING: { label: "Pending", className: "tf-muted-tag" },
  FAILED: { label: "Failed", className: "tf-danger-tag" }
} as const;
type RepoAnalysisStatus = Report["status"];

const isAnalysisInFlight = (status?: RepoAnalysisStatus) =>
  status === "PENDING" || status === "PROCESSING";

export default function RepoAnalysisPage() {
  const hydratedRef = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [availableAiModels, setAvailableAiModels] = useState<AiModelOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisCost, setAnalysisCost] = useState(50);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [analyzingProjectId, setAnalyzingProjectId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Project | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<AnalysisDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "graph" | "system-design">("summary");

  useEffect(() => {
    if (hydratedRef.current || typeof window === "undefined") return;
    hydratedRef.current = true;
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
    if (typeof window === "undefined" || !hydratedRef.current) return;
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
      // Ignore persistence issues.
    }
  }, [selectedOrgId]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const loadData = async (options?: { background?: boolean }) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      setLoading(false);
      return;
    }

    if (!options?.background) {
      setLoading(true);
    }
    setError(null);

    try {
      const [projectsRes, orgsRes] = await Promise.all([
        fetch(`${API_URL}/projects`, {
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

      setProjects((projectsData.projects || []) as Project[]);
      if (projectsData.availableAiModels) {
        setAvailableAiModels(projectsData.availableAiModels);
      }
      if (orgsRes.ok) {
        setOrgs((orgsData.orgs || []) as Org[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      if (!options?.background) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const mappedProjects = useMemo(() => {
    const scopedProjects = selectedOrgId
      ? projects.filter((project) => project.orgId === selectedOrgId)
      : projects.filter((project) => !project.orgId);

    return scopedProjects.filter((project) => !project.archivedAt && project.githubRepoId);
  }, [projects, selectedOrgId]);

  const totalPages = Math.max(1, Math.ceil(mappedProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return mappedProjects.slice(start, start + pageSize);
  }, [mappedProjects, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [selectedOrgId]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const [updatingAiModelProjectId, setUpdatingAiModelProjectId] = useState<string | null>(null);

  const updateProjectAiModel = async (projectId: string, aiModel: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setUpdatingAiModelProjectId(projectId);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/ai-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ aiModel })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update AI model");
      }

      await loadData({ background: true });
      showToast("AI model updated successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setUpdatingAiModelProjectId(null);
    }
  };

  const analyzeProject = async (project: Project, type: "report" | "graph" | "system-design" = "report") => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    if (type === "report") {
      setAnalyzingProjectId(project.id);
    }
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/github-analysis/analyze?type=${type}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = (await res.json()) as AnalysisDetailResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze repository");
      }

      setAnalysisCost(data.analysisCost || 50);
      await loadData({ background: true });
      setReportTarget(project);
      setReport(data);
      showToast("Repository analysis queued", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze repository");
    } finally {
      setAnalyzingProjectId(null);
    }
  };

  const openReport = async (project: Project, options?: { background?: boolean }) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setReportTarget(project);
    setActiveTab("summary");
    if (!options?.background) {
      setReportLoading(true);
      setReport(null);
    }
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/github-analysis`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = (await res.json()) as AnalysisDetailResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load analysis report");
      }

      setAnalysisCost(data.analysisCost || 50);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis report");
    } finally {
      if (!options?.background) {
        setReportLoading(false);
      }
    }
  };

  useEffect(() => {
    const hasInFlightProject = projects.some((project) =>
      isAnalysisInFlight(project.githubRepoAnalysis?.status)
    );
    const hasInFlightReport = isAnalysisInFlight(report?.analysis?.status);

    if (!hasInFlightProject && !hasInFlightReport) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadData({ background: true }).catch(() => undefined);
      if (reportTarget) {
        void openReport(reportTarget, { background: true }).catch(() => undefined);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [projects, report?.analysis?.status, reportTarget]);

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Repo Analysis</h1>
            <PageDescriptionPopover>
              AI-powered codebase analysis for your linked repositories.
              <br /><br />
              Generate a structured AI report for each linked GitHub repository, including
              summary, architecture, tech stack, runtime flow, key modules, and onboarding notes.
              <br /><br />
              Each analysis uses {analysisCost} AI credits on Free and Team plans. Pro remains
              unlimited.
            </PageDescriptionPopover>
          </div>
        </header>

        <section className="flex flex-col xl:flex-row xl:flex-wrap items-start xl:items-center gap-3 mb-6">
          <div 
            className="flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden mask-image-fade py-1"
            style={{ scrollbarWidth: 'none', WebkitMaskImage: 'linear-gradient(to right, black 95%, transparent)' }}
          >
            {[{ id: "", name: "Personal", role: "OWNER" }, ...orgs].map((org) => {
              const isSelected = selectedOrgId === org.id;
              return (
                <button
                  key={org.id}
                  className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    isSelected
                      ? "bg-text-primary text-background shadow-sm"
                      : "text-text-secondary hover:bg-secondary/40 hover:text-text-primary"
                  }`}
                  onClick={() => setSelectedOrgId(org.id)}
                >
                  {org.name}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className="relative z-0 grid gap-4 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="tf-premium-card flex h-full flex-col p-6" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="space-y-3 flex-1">
                  <div className="flex gap-2"><div className="tf-shimmer h-6 w-20 rounded-full bg-secondary/40" /><div className="tf-shimmer h-6 w-16 rounded-full bg-secondary/30" /></div>
                  <div className="tf-shimmer h-5 w-40 rounded-lg bg-secondary/35" />
                  <div className="tf-shimmer h-4 w-56 rounded-lg bg-secondary/25" />
                  <div className="tf-shimmer mt-3 h-20 rounded-xl bg-secondary/20" />
                  <div className="flex gap-2 mt-3"><div className="tf-shimmer h-9 w-28 rounded-full bg-secondary/30" /><div className="tf-shimmer h-9 w-24 rounded-full bg-secondary/20" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : !mappedProjects.length ? (
          <div className="tf-empty-state">
            <div className="tf-empty-state-icon">
              <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 7.5h8M8 12h6M8 16.5h4" /><path d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5Z" strokeLinejoin="round" /></svg>
            </div>
            <p className="tf-empty-state-title">No linked repositories found</p>
            <p className="tf-empty-state-desc">
              Link a GitHub repository to a project first, then come back here to generate a full
              repo report.
            </p>
            <Link className="mt-6 inline-flex tf-button px-5 py-2.5 text-sm" href="/dashboard/projects">
              Open projects
            </Link>
          </div>
        ) : (
          <>
            <div className="relative z-0 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProjects.map((project, index) => {
                const status = project.githubRepoAnalysis?.status || "PENDING";
                const statusStyles = statusMeta[status];
                return (
                  <div key={project.id} className="group flex min-w-0 flex-col p-6 sm:p-8 transition-all duration-500 ease-out rounded-[24px] border border-border/40 bg-gradient-to-b from-card to-card/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:border-border/80 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.15)] hover:-translate-y-[2px] animate-stagger-fade-up" style={{ animationDelay: `${index * 70}ms` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles.className}`}>
                            {status === "PROCESSING" && <span className="tf-status-dot mr-1.5 inline-block bg-current" />}
                            {statusStyles.label}
                          </span>
                          <span className="tf-pill">
                            {selectedOrgId ? orgs.find((org) => org.id === selectedOrgId)?.name || "Organization" : "Personal"}
                          </span>
                        </div>
                        <h2 className="text-[17px] font-semibold text-text-primary truncate tracking-tight">{project.name}</h2>
                        <p className="mt-1 flex items-center gap-1.5 break-all text-sm text-text-secondary">
                          <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
                          {project.githubRepoName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border/40 flex-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary/70 uppercase tracking-[0.15em] mb-3">
                        <span>Latest summary</span>
                      </div>
                      <p className="text-sm leading-6 text-text-secondary">
                        {project.githubRepoAnalysis?.summary ||
                          (project.githubRepoAnalysis?.status === "PROCESSING"
                            ? "The repository report is currently being generated in the background."
                            : project.githubRepoAnalysis?.status === "PENDING"
                              ? "The repository report is queued and will start as soon as a worker is free."
                              : "No report generated yet. Run the first analysis to build the repository summary.")}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium text-text-secondary/60">
                      <span className="tf-pill">
                        <svg aria-hidden="true" className="mr-1 h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 1.5" /></svg>
                        {project.githubRepoAnalysis?.generatedAt
                          ? `Updated ${new Date(project.githubRepoAnalysis.generatedAt).toLocaleString()}`
                          : "Never analyzed"}
                      </span>
                    </div>

                    {project.githubRepoAnalysis?.lastError ? (
                      <div className="mt-3 rounded-xl tf-danger-surface px-4 py-3 text-sm">
                        An error occurred, try again or switch to different model.
                      </div>
                    ) : null}

                    <div className="mt-6 pt-4 border-t border-border/40 flex flex-col gap-1.5 w-full">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        AI Model
                      </label>
                      <select
                        className="w-full appearance-none rounded-sm border border-border bg-secondary/20 px-4 py-2 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 12px center",
                          backgroundSize: "12px 12px"
                        }}
                        value={project.aiModel}
                        onChange={(event) => updateProjectAiModel(project.id, event.target.value)}
                        disabled={loading || updatingAiModelProjectId === project.id || analyzingProjectId === project.id}
                      >
                        {availableAiModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-sm bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 transition-colors text-sm"
                        onClick={() => analyzeProject(project)}
                        disabled={analyzingProjectId === project.id}
                      >
                        <LoadingButtonContent
                          loading={analyzingProjectId === project.id}
                          loadingLabel="Analyzing..."
                          idleLabel={project.githubRepoAnalysis?.generatedAt ? "Refresh analysis" : "Analyze repo"}
                        />
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-sm bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 transition-colors text-sm"
                        onClick={() => openReport(project)}
                      >
                        View report
                      </button>
                      {project.githubRepoUrl ? (
                        <a
                          className="w-full flex items-center justify-center gap-1.5 rounded-sm bg-secondary/20 border border-border/40 hover:bg-secondary/40 text-text-primary font-semibold py-2 px-4 transition-colors text-sm mt-1"
                          href={project.githubRepoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3H3v10h10v-3" /><path d="M9 2h5v5" /><path d="M14 2L7 9" /></svg>
                          Open in GitHub
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {mappedProjects.length > 5 ? (
              <div className="mt-6">
                <DashboardPagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPage(1);
                    setPageSize(nextSize);
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {reportTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 pt-20 pb-24 sm:p-8 sm:pt-[72px] sm:pb-8 backdrop-blur-sm animate-fade-up" style={{ animationDuration: "300ms" }}>
          <div className="tf-glass-modal w-full max-w-3xl max-h-full rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--accent-soft))] text-[hsl(var(--primary))]">
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 7.5h8M8 12h6M8 16.5h4" /><path d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5Z" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{reportTarget.name}</h3>
                  <p className="text-xs text-text-secondary">{reportTarget.githubRepoName}</p>
                </div>
              </div>
              <button onClick={() => {
                  setReportTarget(null);
                  setReport(null);
                }} className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-4 border-b border-border/40 px-6 pt-3">
              <button
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "summary"
                    ? "border-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("summary")}
              >
                Summary
              </button>
              <button
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "graph"
                    ? "border-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("graph")}
              >
                File Graph
              </button>
              <button
                className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "system-design"
                    ? "border-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("system-design")}
              >
                System Design
              </button>
            </div>

            <div className="flex-1 min-h-0 px-6 py-5 overflow-y-auto tf-scroll-rail space-y-4">
              {reportLoading ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="tf-shimmer h-24 rounded-xl bg-secondary/20" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              ) : !report?.analysis ? (
                <div className="tf-empty-state py-10">
                  <div className="tf-empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 7.5h8M8 12h6M8 16.5h4" /><path d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5Z" strokeLinejoin="round" /></svg>
                  </div>
                  <p className="tf-empty-state-title">No analysis available yet</p>
                  <p className="tf-empty-state-desc">Run the first repo analysis to generate a report.</p>
                </div>
              ) : activeTab === "summary" && isAnalysisInFlight(report.analysis.status) ? (
                <div className="tf-metric-card tf-accent-strip-warning">
                  <p className="tf-metric-label">
                    Status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {report.analysis.status === "PROCESSING"
                      ? "Repository analysis is running"
                      : "Repository analysis is queued"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    We're working on the repository report in the background. This modal refreshes
                    automatically and will show the report as soon as it's ready.
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/40">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-[hsl(var(--warning))]" />
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === "summary" ? (
                    <>
                      <div className="rounded-xl border border-border/60 bg-secondary/10 px-5 py-4 animate-stagger-fade-up">
                    <p className="tf-metric-label">
                      Summary
                    </p>
                    <p className="mt-2 text-sm leading-7 text-text-secondary break-words whitespace-pre-wrap">
                      {report.analysis.summary}
                    </p>
                  </div>

                  {[
                    ["Architecture", report.analysis.architecture],
                    ["Runtime flow", report.analysis.runtimeFlow],
                    ["Development flow", report.analysis.developmentFlow]
                  ].map(([label, value], i) =>
                    value ? (
                      <div key={label} className="rounded-xl border border-border/60 bg-secondary/10 px-5 py-4 animate-stagger-fade-up" style={{ animationDelay: `${(i + 1) * 80}ms` }}>
                        <p className="tf-metric-label">
                          {label}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-text-secondary break-words whitespace-pre-wrap">{value}</p>
                      </div>
                    ) : null
                  )}

                  {([
                    ["Tech stack", report.analysis.techStack],
                    ["Key modules", report.analysis.keyModules],
                    ["Entry points", report.analysis.entryPoints],
                    ["Risks", report.analysis.risks],
                    ["Onboarding tips", report.analysis.onboardingTips]
                  ] as Array<[string, string[] | undefined]>).map(([label, list], i) =>
                    Array.isArray(list) && list.length ? (
                      <div key={label} className="rounded-xl border border-border/60 bg-secondary/10 px-5 py-4 animate-stagger-fade-up" style={{ animationDelay: `${(i + 4) * 80}ms` }}>
                        <p className="tf-metric-label">
                          {label}
                        </p>
                        <div className="mt-3 space-y-1.5">
                          {list.map((item) => (
                            <div key={`${label}-${item}`} className="flex gap-2 text-sm leading-7 text-text-secondary">
                              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                              <span className="break-words whitespace-pre-wrap">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}

                  {activeTab === "summary" && report.analysis.lastError ? (
                    <div className="rounded-xl tf-danger-surface px-5 py-4 text-sm whitespace-pre-wrap">
                      {report.analysis.lastError}
                    </div>
                  ) : null}
                  </>
                ) : null}

                  {activeTab === "graph" ? (
                    <div className="animate-fade-up">
                      {report.analysis.graphStatus === "UNINITIALIZED" || !report.analysis.graphStatus ? (
                        <div className="tf-empty-state py-10">
                          <p className="tf-empty-state-title">File Graph Not Generated</p>
                          <p className="tf-empty-state-desc mb-4">Generate the file graph to view the repository structure.</p>
                          <button
                            type="button"
                            className="tf-button px-4 py-2 text-sm"
                            onClick={() => analyzeProject(reportTarget, "graph")}
                            disabled={analyzingProjectId === reportTarget.id}
                          >
                            <LoadingButtonContent loading={analyzingProjectId === reportTarget.id} loadingLabel="Generating..." idleLabel="Generate File Graph" />
                          </button>
                        </div>
                      ) : report.analysis.graphStatus === "PENDING" || report.analysis.graphStatus === "PROCESSING" ? (
                         <div className="tf-metric-card tf-accent-strip-warning">
                           <p className="tf-metric-label">Generating File Graph...</p>
                           <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/40">
                             <div className="h-full w-1/3 animate-pulse rounded-full bg-[hsl(var(--warning))]" />
                           </div>
                         </div>
                      ) : report.analysis.graphStatus === "FAILED" ? (
                        <div className="tf-empty-state py-10">
                          <p className="tf-empty-state-title text-[hsl(var(--destructive))]">Generation Failed</p>
                          <p className="tf-empty-state-desc mb-4">An error occurred while generating the file graph. Please try again.</p>
                          <button
                            type="button"
                            className="tf-button px-4 py-2 text-sm"
                            onClick={() => analyzeProject(reportTarget, "graph")}
                            disabled={analyzingProjectId === reportTarget.id}
                          >
                            <LoadingButtonContent loading={analyzingProjectId === reportTarget.id} loadingLabel="Retrying..." idleLabel="Retry Generation" />
                          </button>
                        </div>
                      ) : (
                        <RepoGraphViewer folderTree={report.analysis.folderTree || []} />
                      )}
                    </div>
                  ) : null}

                  {activeTab === "system-design" ? (
                    <div className="animate-fade-up">
                      {report.analysis.systemDesignStatus === "UNINITIALIZED" || !report.analysis.systemDesignStatus ? (
                        <div className="tf-empty-state py-10">
                          <p className="tf-empty-state-title">System Design Not Generated</p>
                          <p className="tf-empty-state-desc mb-4">Generate the system design using AI to view architecture components.</p>
                          <button
                            type="button"
                            className="tf-button px-4 py-2 text-sm"
                            onClick={() => analyzeProject(reportTarget, "system-design")}
                            disabled={analyzingProjectId === reportTarget.id}
                          >
                            <LoadingButtonContent loading={analyzingProjectId === reportTarget.id} loadingLabel="Generating..." idleLabel="Generate System Design" />
                          </button>
                        </div>
                      ) : report.analysis.systemDesignStatus === "PENDING" || report.analysis.systemDesignStatus === "PROCESSING" ? (
                         <div className="tf-metric-card tf-accent-strip-warning">
                           <p className="tf-metric-label">Generating System Design...</p>
                           <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/40">
                             <div className="h-full w-1/3 animate-pulse rounded-full bg-[hsl(var(--warning))]" />
                           </div>
                         </div>
                      ) : report.analysis.systemDesignStatus === "FAILED" ? (
                        <div className="tf-empty-state py-10">
                          <p className="tf-empty-state-title text-[hsl(var(--destructive))]">Generation Failed</p>
                          <p className="tf-empty-state-desc mb-4">An error occurred while generating the system design. Please try again.</p>
                          <button
                            type="button"
                            className="tf-button px-4 py-2 text-sm"
                            onClick={() => analyzeProject(reportTarget, "system-design")}
                            disabled={analyzingProjectId === reportTarget.id}
                          >
                            <LoadingButtonContent loading={analyzingProjectId === reportTarget.id} loadingLabel="Retrying..." idleLabel="Retry Generation" />
                          </button>
                        </div>
                      ) : (
                        <SystemDesignViewer systemDesign={report.analysis.systemDesign || []} />
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`tf-dashboard-toast animate-fade-up ${
            toast.tone === "success"
              ? "bg-[hsl(var(--success))] text-white"
              : "bg-[hsl(var(--destructive))] text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
