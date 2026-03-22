"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, BellRing, Pause, Play, RotateCcw } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Project = {
  id: string;
  name: string;
};

type AlertRule = {
  id: string;
  name: string;
  environment: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  minOccurrences: number;
  cooldownMinutes: number;
  channel: "IN_APP";
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  project: Project | null;
  _count: {
    deliveries: number;
  };
};

type AlertEvent = {
  id: string;
  environment: string | null;
  message: string;
  triggeredAt: string;
  project: Project;
  error: {
    id: string;
    count: number;
  };
  alertRule: {
    id: string;
    name: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
  };
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const severityTone: Record<AlertRule["severity"], string> = {
  CRITICAL: "tf-danger-tag",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  INFO: "border-border bg-secondary/70 text-text-secondary"
};

const relativeTime = (value: string | null) => {
  if (!value) return "Never";
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
};

export default function AlertsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [archivedRules, setArchivedRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AlertRule | null>(null);
  const [archivingRuleId, setArchivingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [severity, setSeverity] = useState<AlertRule["severity"]>("CRITICAL");
  const [minOccurrences, setMinOccurrences] = useState("1");
  const [cooldownMinutes, setCooldownMinutes] = useState("30");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertRule["severity"] | "">("");
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | "">("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [restoringRuleId, setRestoringRuleId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadData = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setLoading(false);
      setError("Missing auth token. Please log in again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectsRes, rulesRes, archivedRulesRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/alerts/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/alerts/rules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/alerts/rules?archived=true`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/alerts/events`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [projectsData, rulesData, archivedRulesData, eventsData] = await Promise.all([
        projectsRes.json(),
        rulesRes.json(),
        archivedRulesRes.json(),
        eventsRes.json()
      ]);

      if (!projectsRes.ok) throw new Error(projectsData.error || "Failed to load projects");
      if (!rulesRes.ok) throw new Error(rulesData.error || "Failed to load alert rules");
      if (!archivedRulesRes.ok) {
        throw new Error(archivedRulesData.error || "Failed to load archived alert rules");
      }
      if (!eventsRes.ok) throw new Error(eventsData.error || "Failed to load alert events");

      setProjects(projectsData.projects || []);
      setRules(rulesData.rules || []);
      setArchivedRules(archivedRulesData.rules || []);
      setEvents(eventsData.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const activeRules = useMemo(() => rules.filter((rule) => rule.isActive), [rules]);
  const triggeredToday = useMemo(
    () =>
      events.filter((event) => Date.now() - new Date(event.triggeredAt).getTime() < 86400000)
        .length,
    [events]
  );
  const displayedRules = view === "archived" ? archivedRules : rules;
  const filteredRules = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return displayedRules.filter((rule) => {
      const matchesSearch =
        !needle ||
        rule.name.toLowerCase().includes(needle) ||
        (rule.project?.name || "all projects").toLowerCase().includes(needle);
      const matchesProject = !projectFilter || rule.project?.id === projectFilter;
      const matchesEnvironment =
        !environmentFilter || (rule.environment || "") === environmentFilter;
      const matchesSeverity = !severityFilter || rule.severity === severityFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" ? rule.isActive : !rule.isActive);

      return (
        matchesSearch &&
        matchesProject &&
        matchesEnvironment &&
        matchesSeverity &&
        matchesStatus
      );
    });
  }, [
    displayedRules,
    debouncedSearch,
    projectFilter,
    environmentFilter,
    severityFilter,
    statusFilter
  ]);
  const filteredEvents = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch =
        !needle ||
        event.message.toLowerCase().includes(needle) ||
        event.alertRule.name.toLowerCase().includes(needle) ||
        event.project.name.toLowerCase().includes(needle);
      const matchesProject = !projectFilter || event.project.id === projectFilter;
      const matchesEnvironment =
        !environmentFilter || (event.environment || "") === environmentFilter;
      const matchesSeverity = !severityFilter || event.alertRule.severity === severityFilter;

      return matchesSearch && matchesProject && matchesEnvironment && matchesSeverity;
    });
  }, [events, debouncedSearch, projectFilter, environmentFilter, severityFilter]);

  const resetForm = () => {
    setName("");
    setProjectId(projects[0]?.id || "");
    setEnvironment("");
    setSeverity("CRITICAL");
    setMinOccurrences("1");
    setCooldownMinutes("30");
  };

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    setProjectId((current) => current || projects[0].id);
  }, [projects]);

  const createRule = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setError("Missing auth token. Please log in again.");
      return;
    }

    if (!name.trim()) {
      setError("Rule name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/alerts/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || undefined,
          environment: environment || undefined,
          severity,
          minOccurrences: Number(minOccurrences),
          cooldownMinutes: Number(cooldownMinutes),
          channel: "IN_APP"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create alert rule");
      }

      setRules((prev) => [data.rule, ...prev]);
      resetForm();
      setShowCreateModal(false);
      showToast("Alert rule created", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create alert rule";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const updateRule = async (ruleId: string, body: Record<string, unknown>, success: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/alerts/rules/${ruleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update alert rule");
      }

      setRules((prev) => prev.map((rule) => (rule.id === ruleId ? data.rule : rule)));
      showToast(success, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update alert rule", "error");
    }
  };

  const archiveRule = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !archiveTarget) return;

    try {
      setArchivingRuleId(archiveTarget.id);
      const res = await fetch(`${API_URL}/alerts/rules/${archiveTarget.id}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive alert");
      }

      const archivedRule = rules.find((rule) => rule.id === archiveTarget.id);
      setRules((prev) => prev.filter((rule) => rule.id !== archiveTarget.id));
      if (archivedRule) {
        setArchivedRules((prev) => [archivedRule, ...prev]);
      }
      setArchiveTarget(null);
      showToast("Alert archived", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to archive alert", "error");
    } finally {
      setArchivingRuleId(null);
    }
  };

  const restoreRule = async (ruleId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    try {
      setRestoringRuleId(ruleId);
      const res = await fetch(`${API_URL}/alerts/rules/${ruleId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore alert");
      }

      setArchivedRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      setRules((prev) => [data.rule, ...prev]);
      showToast("Alert restored", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to restore alert", "error");
    } finally {
      setRestoringRuleId(null);
    }
  };

  const sendTestAlert = async (ruleId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setTestingRuleId(ruleId);
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${ruleId}/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test alert");
      }

      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                lastTriggeredAt: data.delivery.triggeredAt,
                _count: {
                  deliveries: rule._count.deliveries + 1
                }
              }
            : rule
        )
      );
      showToast("Alert notified to team", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send test alert", "error");
    } finally {
      setTestingRuleId(null);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Alerts</p>
            <h1 className="tf-title mt-3 text-3xl">Alert rules</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Create issue thresholds that watch your projects and notify you in real time
              when operational risk starts climbing.
            </p>
          </div>
          <button
            type="button"
            className="tf-button px-4 py-2 text-sm"
            onClick={() => {
              setError(null);
              setShowCreateModal(true);
            }}
          >
            Create alert
          </button>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Active rules
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{activeRules.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Recent triggers
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{triggeredToday}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Tracked projects
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{projects.length}</p>
          </div>
        </section>

        {error && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="tf-filter-panel mt-6">
          <div className="tf-filter-header">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Search and filter</h2>
              <p className="tf-filter-help">
                Narrow alert rules and recent activity without leaving the page.
              </p>
            </div>
            <button
              type="button"
              className="tf-filter-reset"
              onClick={() => {
                setSearch("");
                setProjectFilter("");
                setEnvironmentFilter("");
                setSeverityFilter("");
                setStatusFilter("");
              }}
            >
              Reset filters
            </button>
          </div>

          <div className="tf-filter-grid md:grid-cols-2 xl:grid-cols-5">
            <label className="tf-filter-field">
              <span className="tf-filter-label">Search</span>
              <input
                className="tf-input tf-filter-control w-full"
                placeholder="Search rules, events, or projects"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="tf-filter-field">
              <span className="tf-filter-label">Project</span>
              <select
                className="tf-select tf-filter-control w-full"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
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
                className="tf-select tf-filter-control w-full"
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
                className="tf-select tf-filter-control w-full"
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as AlertRule["severity"] | "")
                }
              >
                <option value="">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </label>

            <label className="tf-filter-field">
              <span className="tf-filter-label">Status</span>
              <select
                className="tf-select tf-filter-control w-full"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "active" | "paused" | "")}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <div className="tf-filter-pills">
            <span className="tf-filter-pill">{projectFilter ? "Project scoped" : "All projects"}</span>
            <span className="tf-filter-pill">{environmentFilter || "All environments"}</span>
            <span className="tf-filter-pill">{statusFilter || "Any status"}</span>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div>
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {view === "archived" ? "Archived alerts" : "Your rules"}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {view === "archived"
                      ? "Bring back archived rules whenever you want them in the live workflow again."
                      : "Active alert coverage across your projects and environments."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-border bg-card p-1">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        view === "active"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-text-secondary hover:bg-secondary/70"
                      }`}
                      onClick={() => setView("active")}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        view === "archived"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-text-secondary hover:bg-secondary/70"
                      }`}
                      onClick={() => setView("archived")}
                    >
                      Archived
                    </button>
                  </div>
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
                    {filteredRules.length} shown
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {loading && (
                <div className="rounded-2xl border border-border bg-card/90 p-6 text-sm text-text-secondary">
                  Loading alert rules...
                </div>
              )}

              {!loading && !filteredRules.length && (
                <div className="rounded-2xl border border-border bg-card/90 p-6">
                  <p className="text-sm font-semibold text-text-primary">
                    {view === "archived" ? "No archived alerts" : "No matching alert rules"}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {view === "archived"
                      ? "Archived rules will show up here once you archive them from the active list."
                      : "Adjust the filters above or create a new alert rule for the projects you want to watch."}
                  </p>
                </div>
              )}

              {!loading &&
                filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-text-primary">
                            {rule.name}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityTone[rule.severity]}`}
                          >
                            {rule.severity}
                          </span>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                            {rule.isActive ? "Active" : "Paused"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              Scope
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-primary">
                              {rule.project?.name ?? "All projects"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              Environment
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-primary">
                              {rule.environment || "All environments"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              Trigger
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-primary">
                              {rule.minOccurrences} occurrence{rule.minOccurrences > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              Cooldown
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-primary">
                              {rule.cooldownMinutes} minutes
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                          <span>Last triggered {relativeTime(rule.lastTriggeredAt)}</span>
                          <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                          <span>
                            Fired {rule._count.deliveries} time
                            {rule._count.deliveries === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[176px]">
                        {view === "active" ? (
                          <>
                            <button
                              type="button"
                              className="tf-button flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
                              onClick={() => sendTestAlert(rule.id)}
                              disabled={testingRuleId === rule.id}
                            >
                              <BellRing className="h-4 w-4" />
                              {testingRuleId === rule.id ? "Sending..." : "Notify"}
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                              onClick={() =>
                                updateRule(
                                  rule.id,
                                  { isActive: !rule.isActive },
                                  rule.isActive ? "Alert paused" : "Alert resumed"
                                )
                              }
                            >
                              {rule.isActive ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              {rule.isActive ? "Pause" : "Resume"}
                            </button>
                            <button
                              type="button"
                              className="tf-danger-button flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
                              onClick={() => setArchiveTarget(rule)}
                            >
                              <Archive className="h-4 w-4" />
                              Archive
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            onClick={() => restoreRule(rule.id)}
                            disabled={restoringRuleId === rule.id}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {restoringRuleId === rule.id ? "Restoring..." : "Restore alert"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Recent activity</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Latest alert deliveries and quick jumps into issues.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
                  {filteredEvents.length} events
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loading && (
                  <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-4 text-sm text-text-secondary">
                    Loading alert history...
                  </div>
                )}

                {!loading && !filteredEvents.length && (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">
                      No matching alert activity
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Try widening the filters or trigger an alert to see recent activity here.
                    </p>
                  </div>
                )}

                {!loading &&
                  filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-border bg-card px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary">
                            {event.alertRule.name}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">{event.message}</p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityTone[event.alertRule.severity]}`}
                        >
                          {event.alertRule.severity}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span className="rounded-full border border-border bg-card px-2.5 py-1">
                          {event.project.name}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1">
                          {event.environment || "All environments"}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1">
                          {relativeTime(event.triggeredAt)}
                        </span>
                      </div>

                      <div className="mt-4">
                        <Link
                          className="tf-button-ghost px-4 py-2 text-sm"
                          href={`/dashboard/errors/${event.error.id}`}
                        >
                          Open issue
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Archive alert
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This will hide the alert rule from the active list without permanently deleting it.
            </p>
            <p className="mt-3 rounded-2xl border border-border bg-secondary/25 px-4 py-3 text-sm text-text-primary">
              {archiveTarget.name}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={() => setArchiveTarget(null)}
                disabled={archivingRuleId === archiveTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                onClick={archiveRule}
                disabled={archivingRuleId === archiveTarget.id}
              >
                {archivingRuleId === archiveTarget.id ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Create alert rule
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Choose the severity, scope, and cooldown so TraceForge only interrupts you
              when it matters.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Rule name
                </label>
                <input
                  className="tf-input w-full"
                  placeholder="Critical production regressions"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Project scope
                </label>
                <select
                  className="tf-select w-full"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Environment
                </label>
                <select
                  className="tf-select w-full"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value)}
                >
                  <option value="">All environments</option>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="browser">Browser</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Minimum severity
                </label>
                <select
                  className="tf-select w-full"
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.target.value as AlertRule["severity"])
                  }
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning and above</option>
                  <option value="INFO">Any issue</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Trigger after
                </label>
                <input
                  className="tf-input w-full"
                  inputMode="numeric"
                  value={minOccurrences}
                  onChange={(event) => setMinOccurrences(event.target.value)}
                  placeholder="1"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Cooldown (minutes)
                </label>
                <input
                  className="tf-input w-full"
                  inputMode="numeric"
                  value={cooldownMinutes}
                  onChange={(event) => setCooldownMinutes(event.target.value)}
                  placeholder="30"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={() => {
                  setShowCreateModal(false);
                  setError(null);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={createRule}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create alert"}
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
