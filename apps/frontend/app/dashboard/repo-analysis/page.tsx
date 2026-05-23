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
        <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
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
          </div>
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
        </header>

        <div className="tf-divider my-6" />

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-sm text-text-secondary">Loading mapped repositories...</p>
          </div>
        ) : !mappedProjects.length ? (
          <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">No linked repositories found</p>
            <p className="mt-2 text-sm text-text-secondary">
              Link a GitHub repository to a project first, then come back here to generate a full
              repo report.
            </p>
            <Link className="mt-4 inline-flex tf-button px-4 py-2 text-sm" href="/dashboard/projects">
              Open projects
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {paginatedProjects.map((project) => {
                const status = project.githubRepoAnalysis?.status || "PENDING";
                const statusStyles = statusMeta[status];
                return (
                  <div key={project.id} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles.className}`}>
                            {statusStyles.label}
                          </span>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                            {selectedOrgId ? orgs.find((org) => org.id === selectedOrgId)?.name || "Organization" : "Personal"}
                          </span>
                        </div>
                        <h2 className="mt-3 text-lg font-semibold text-text-primary">{project.name}</h2>
                        <p className="mt-1 break-all text-sm text-text-secondary">
                          {project.githubRepoName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
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
                      <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1">
                        {project.githubRepoAnalysis?.generatedAt
                          ? `Updated ${new Date(project.githubRepoAnalysis.generatedAt).toLocaleString()}`
                          : "Never analyzed"}
                      </span>
                    </div>

                    {project.githubRepoAnalysis?.lastError ? (
                      <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                        {project.githubRepoAnalysis.lastError}
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
                          className="tf-pill"
                          href={project.githubRepoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open repo
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {mappedProjects.length > 5 ? (
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
            ) : null}
          </>
        )}
      </div>

      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl max-h-[70vh] sm:max-h-[90vh] rounded-2xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Repo Analysis: {reportTarget.name}</h3>
              <button onClick={() => {
                  setReportTarget(null);
                  setReport(null);
                }} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {reportLoading ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  Loading report...
                </div>
              ) : !report?.analysis ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary">
                  No analysis available yet. Run the first repo analysis to generate a report.
                </div>
              ) : isAnalysisInFlight(report.analysis.status) ? (
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
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
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-secondary/20 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
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
                  ].map(([label, value]) =>
                    value ? (
                      <div key={label} className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
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
                  ] as Array<[string, string[] | undefined]>).map(([label, list]) =>
                    Array.isArray(list) && list.length ? (
                      <div key={label} className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          {label}
                        </p>
                        <div className="mt-3 space-y-2">
                          {list.map((item) => (
                            <p key={`${label}-${item}`} className="text-sm leading-7 text-text-secondary break-words whitespace-pre-wrap">
                              • {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}

                  {report.analysis.lastError ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-300">
                      {report.analysis.lastError}
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
          className="tf-dashboard-toast"
          style={{
            background: toast.tone === "success" ? "#16a34a" : "#dc2626",
            color: "white"
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
