"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { X } from "lucide-react";
import { DashboardPagination } from "../components/DashboardPagination";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

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
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
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

  const analyzeProject = async (project: Project) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setAnalyzingProjectId(project.id);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/github-analysis/analyze`, {
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
        <header className="mt-2 flex flex-wrap items-center justify-between gap-4 animate-stagger-fade-up">
          <div className="tf-section-header">
            <p className="tf-kicker">GitHub</p>
            <div className="mt-2 flex items-center">
              <h1 className="font-display text-2xl font-semibold text-text-primary">
                Repo Analysis
              </h1>
              <PageDescriptionPopover>
                Generate a structured AI report for each linked GitHub repository, including
                summary, architecture, tech stack, runtime flow, key modules, and onboarding notes.
                <br /><br />
                Each analysis uses {analysisCost} AI credits on Free and Team plans. Pro remains
                unlimited.
              </PageDescriptionPopover>
            </div>
            <p className="tf-section-desc">AI-powered codebase analysis for your linked repositories.</p>
          </div>
          <label className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2.5 text-xs font-semibold text-text-secondary shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M4 19a5 5 0 0 1 10 0" /><path d="M14.5 19a4 4 0 0 1 7 0" /></svg>
            <select
              className="bg-transparent text-xs font-semibold text-text-primary outline-none cursor-pointer"
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
        </header>

        <div className="my-8" />

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
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
            <div className="grid gap-5 xl:grid-cols-2">
              {paginatedProjects.map((project, index) => {
                const status = project.githubRepoAnalysis?.status || "PENDING";
                const statusStyles = statusMeta[status];
                const accentClass = status === "READY" ? "tf-accent-strip-success" : status === "PROCESSING" ? "tf-accent-strip-warning" : status === "FAILED" ? "tf-accent-strip-danger" : "tf-accent-strip-info";
                return (
                  <div key={project.id} className={`tf-metric-card ${accentClass} flex h-full flex-col p-5 animate-stagger-fade-up`} style={{ animationDelay: `${index * 80}ms` }}>
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
                        <h2 className="mt-3 text-lg font-semibold text-text-primary">{project.name}</h2>
                        <p className="mt-1 flex items-center gap-1.5 break-all text-sm text-text-secondary">
                          <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
                          {project.githubRepoName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex-1 rounded-xl border border-border/60 bg-secondary/15 px-4 py-4">
                      <p className="tf-metric-label">
                        Latest summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">
                        {project.githubRepoAnalysis?.summary ||
                          (project.githubRepoAnalysis?.status === "PROCESSING"
                            ? "The repository report is currently being generated in the background."
                            : project.githubRepoAnalysis?.status === "PENDING"
                              ? "The repository report is queued and will start as soon as a worker is free."
                              : "No report generated yet. Run the first analysis to build the repository summary.")}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
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

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="tf-button px-4 py-2 text-sm"
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
                        className="tf-button-ghost px-4 py-2 text-sm"
                        onClick={() => openReport(project)}
                      >
                        View report
                      </button>
                      {project.githubRepoUrl ? (
                        <a
                          className="tf-pill transition hover:border-primary/30 hover:text-text-primary"
                          href={project.githubRepoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <svg aria-hidden="true" className="mr-1 h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3H3v10h10v-3" /><path d="M9 2h5v5" /><path d="M14 2L7 9" /></svg>
                          Open repo
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm animate-fade-up" style={{ animationDuration: "300ms" }}>
          <div className="tf-glass-modal w-full max-w-3xl max-h-[70vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
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

            <div className="px-6 py-5 overflow-y-auto tf-scroll-rail space-y-4">
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
              ) : isAnalysisInFlight(report.analysis.status) ? (
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

                  {report.analysis.lastError ? (
                    <div className="rounded-xl tf-danger-surface px-5 py-4 text-sm">
                      An error occurred, try again or switch to different model.
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
