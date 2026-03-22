"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
};

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-border bg-card/90 p-6 ${className}`}>
      <div className="h-4 w-36 rounded-full bg-secondary/90" />
      <div className="mt-2 h-3 w-52 rounded-full bg-secondary/70" />
      <div className="mt-6 h-56 rounded-2xl bg-secondary/70" />
    </div>
  );
}

function EmptyChartCard({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          No data
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/30 p-5">
        <div className="flex h-56 items-center justify-center rounded-2xl bg-card/70">
          <div className="text-center">
            <p className="text-sm font-semibold text-text-primary">No data available yet</p>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">
              This chart will populate once your projects start sending enough events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyInsightList() {
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Top recurring issues</h2>
          <p className="mt-1 text-sm text-text-secondary">
            The noisiest issues across your tracked projects.
          </p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          No data
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-4"
          >
            <p className="text-sm font-semibold text-text-primary">No issue data yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Once events arrive, recurring issue patterns will appear here.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setLoading(false);
      return;
    }

    const loadProjects = async () => {
      try {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        window.setTimeout(() => setLoading(false), 350);
      }
    };

    void loadProjects();
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const scopeLabel = selectedProject ? selectedProject.name : "All projects";

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tf-kicker">Insights</p>
            <h1 className="tf-title mt-3 text-3xl">Operational insights</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Start with overall trends across the account, then narrow to a single
              project when you want a focused view.
            </p>
          </div>

          <div className="tf-filter-panel w-full sm:max-w-sm">
            <div className="tf-filter-field">
              <label className="tf-filter-label">Scope</label>
              <select
                className="tf-select tf-filter-control w-full"
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
            </div>
            <div className="tf-filter-pills mt-3">
              <span className="tf-filter-pill">{selectedProject ? selectedProject.name : "Account-wide view"}</span>
            </div>
          </div>
        </header>

        {!loading && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
              Viewing: {scopeLabel}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
              {selectedProject ? "Project-specific view" : "Overall account view"}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <ChartSkeleton />
              <ChartSkeleton />
            </section>

            <section className="mt-6">
              <ChartSkeleton />
            </section>
          </>
        ) : (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <EmptyChartCard
                title="Issue volume trend"
                description="Track how issue traffic changes over time across environments."
              />
              <EmptyChartCard
                title="Environment health"
                description="Compare production, staging, and development reliability at a glance."
              />
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <EmptyChartCard
                title="Project performance"
                description="See which projects are generating the most operational noise."
              />
              <EmptyInsightList />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
