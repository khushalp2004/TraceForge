"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, BellRing, Pause, Play, RotateCcw, Send, Trash2 } from "lucide-react";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { DashboardPagination } from "../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const alertsPrefsKey = "traceforge_alerts_prefs_v1";

type Project = {
  id: string;
  name: string;
  orgId?: string | null;
};

type AlertRule = {
  id: string;
  name: string;
  issueDescription: string | null;
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

type AlertAppTargetsResponse = {
  rule: {
    id: string;
    name: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    projectName: string;
    environment: string | null;
    issueDescription: string | null;
  };
  targets: {
    slack: {
      connected: boolean;
      ready: boolean;
      label: string;
      reason?: string;
    };
    jira: {
      connected: boolean;
      ready: boolean;
      label: string;
      reason?: string;
    };
  };
};

const severityTone: Record<AlertRule["severity"], string> = {
  CRITICAL: "tf-danger-tag",
  WARNING: "tf-warning-tag",
  INFO: "tf-muted-tag"
};

const ALERT_EVENT_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

const relativeTime = (value: string | null) => {
  if (!value) return "Never";
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
};

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <AlertsPageInner />
    </Suspense>
  );
}

function AlertsPageInner() {
  const searchParams = useSearchParams();
  const hydratedFromQuery = useRef(false);
  const prefsHydratedRef = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [archivedRules, setArchivedRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyingRuleId, setNotifyingRuleId] = useState<string | null>(null);
  const [appModalRule, setAppModalRule] = useState<AlertRule | null>(null);
  const [loadingAppTargets, setLoadingAppTargets] = useState(false);
  const [sendingAppAlert, setSendingAppAlert] = useState(false);
  const [appTargets, setAppTargets] = useState<AlertAppTargetsResponse | null>(null);
  const [appAlertMessage, setAppAlertMessage] = useState("");
  const [sendToSlack, setSendToSlack] = useState(false);
  const [sendToJira, setSendToJira] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);
  const [archivingRuleId, setArchivingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [name, setName] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
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
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesPageSize, setRulesPageSize] = useState(6);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize, setEventsPageSize] = useState(5);
  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    if (hydratedFromQuery.current) return;
    hydratedFromQuery.current = true;

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(alertsPrefsKey);
        if (raw) {
          const prefs = JSON.parse(raw) as {
            search?: string;
            projectId?: string;
            environment?: string;
            severity?: AlertRule["severity"] | "";
            status?: "active" | "paused" | "";
            view?: "active" | "archived";
            rulesPageSize?: number;
            eventsPageSize?: number;
          };

          if (typeof prefs.search === "string") setSearch(prefs.search);
          if (typeof prefs.projectId === "string") setProjectFilter(prefs.projectId);
          if (typeof prefs.environment === "string") setEnvironmentFilter(prefs.environment);
          if (prefs.severity === "" || prefs.severity === "CRITICAL" || prefs.severity === "WARNING" || prefs.severity === "INFO") {
            setSeverityFilter(prefs.severity);
          }
          if (prefs.status === "" || prefs.status === "active" || prefs.status === "paused") {
            setStatusFilter(prefs.status);
          }
          if (prefs.view === "active" || prefs.view === "archived") setView(prefs.view);
          if (typeof prefs.rulesPageSize === "number" && prefs.rulesPageSize > 0) setRulesPageSize(prefs.rulesPageSize);
          if (typeof prefs.eventsPageSize === "number" && prefs.eventsPageSize > 0) setEventsPageSize(prefs.eventsPageSize);
        }
      } catch {
        // Ignore malformed prefs.
      } finally {
        prefsHydratedRef.current = true;
      }
    }

    const queryQ = searchParams.get("q") || "";
    const queryProjectId = searchParams.get("projectId") || "";
    const queryEnv = searchParams.get("env") || "";
    const querySeverity = (searchParams.get("severity") || "").toUpperCase();
    const queryStatus = (searchParams.get("status") || "").toLowerCase();
    const queryView = (searchParams.get("view") || "").toLowerCase();
    const queryPageSize = Number(searchParams.get("pageSize") || "");

    if (queryQ) setSearch(queryQ);
    if (queryProjectId) setProjectFilter(queryProjectId);
    if (queryEnv) setEnvironmentFilter(queryEnv);
    if (querySeverity === "CRITICAL" || querySeverity === "WARNING" || querySeverity === "INFO") {
      setSeverityFilter(querySeverity as AlertRule["severity"]);
    }
    if (queryStatus === "active" || queryStatus === "paused") {
      setStatusFilter(queryStatus);
    }
    if (queryView === "active" || queryView === "archived") {
      setView(queryView);
    }
    if (Number.isFinite(queryPageSize) && queryPageSize > 0) {
      setRulesPageSize(queryPageSize);
    }
    setRulesPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
    window.localStorage.setItem(
      alertsPrefsKey,
      JSON.stringify({
        search,
        projectId: projectFilter,
        environment: environmentFilter,
        severity: severityFilter,
        status: statusFilter,
        view,
        rulesPageSize,
        eventsPageSize
      })
    );
  }, [search, projectFilter, environmentFilter, severityFilter, statusFilter, view, rulesPageSize, eventsPageSize]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

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
  const eventsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEvents.length / eventsPageSize)),
    [filteredEvents.length, eventsPageSize]
  );
  const paginatedEvents = useMemo(() => {
    const start = (eventsPage - 1) * eventsPageSize;
    return filteredEvents.slice(start, start + eventsPageSize);
  }, [filteredEvents, eventsPage, eventsPageSize]);

  const rulesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRules.length / rulesPageSize)),
    [filteredRules.length, rulesPageSize]
  );

  const paginatedRules = useMemo(() => {
    const start = (rulesPage - 1) * rulesPageSize;
    return filteredRules.slice(start, start + rulesPageSize);
  }, [filteredRules, rulesPage, rulesPageSize]);

  const visibleRulePages = useMemo(() => {
    if (rulesTotalPages <= 5) {
      return Array.from({ length: rulesTotalPages }, (_, index) => index + 1);
    }

    if (rulesPage <= 3) {
      return [1, 2, 3, 4, rulesTotalPages];
    }

    if (rulesPage >= rulesTotalPages - 2) {
      return [1, rulesTotalPages - 3, rulesTotalPages - 2, rulesTotalPages - 1, rulesTotalPages];
    }

    return [1, rulesPage - 1, rulesPage, rulesPage + 1, rulesTotalPages];
  }, [rulesPage, rulesTotalPages]);

  const resetForm = () => {
    setName("");
    setIssueDescription("");
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

  useEffect(() => {
    setRulesPage(1);
    setEventsPage(1);
  }, [debouncedSearch, projectFilter, environmentFilter, severityFilter, statusFilter, view]);

  useEffect(() => {
    setRulesPage((current) => Math.min(current, rulesTotalPages));
  }, [rulesTotalPages]);

  useEffect(() => {
    setEventsPage((current) => Math.min(current, eventsTotalPages));
  }, [eventsTotalPages]);

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
          issueDescription: issueDescription.trim() || undefined,
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

  const deleteRulePermanently = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !deleteTarget) return;

    try {
      setDeletingRuleId(deleteTarget.id);
      const res = await fetch(`${API_URL}/alerts/rules/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete alert");
      }

      setArchivedRules((prev) => prev.filter((rule) => rule.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Alert deleted permanently", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete alert", "error");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const sendAlertNotification = async (ruleId: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setNotifyingRuleId(ruleId);
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${ruleId}/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send alert notification");
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
      showToast("Alert notification sent", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send alert notification", "error");
    } finally {
      setNotifyingRuleId(null);
    }
  };

  const openAppAlertModal = async (rule: AlertRule) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setAppModalRule(rule);
    setAppAlertMessage("");
    setSendToSlack(false);
    setSendToJira(false);
    setLoadingAppTargets(true);
    setAppTargets(null);

    try {
      const res = await fetch(`${API_URL}/alerts/rules/${rule.id}/apps`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = (await res.json()) as AlertAppTargetsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load app destinations");
      }

      setAppTargets(data);
      setSendToSlack(Boolean(data.targets.slack.ready));
      setSendToJira(Boolean(data.targets.jira.ready));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load destinations", "error");
    } finally {
      setLoadingAppTargets(false);
    }
  };

  const closeAppAlertModal = () => {
    if (sendingAppAlert) return;
    setAppModalRule(null);
    setAppTargets(null);
    setAppAlertMessage("");
    setSendToSlack(false);
    setSendToJira(false);
    setLoadingAppTargets(false);
  };

  const sendAppAlert = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !appModalRule) return;

    if (!sendToSlack && !sendToJira) {
      showToast("Choose at least one app destination", "error");
      return;
    }

    setSendingAppAlert(true);
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${appModalRule.id}/apps/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: appAlertMessage.trim() || undefined,
          destinations: {
            slack: sendToSlack,
            jira: sendToJira
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send alert to apps");
      }

      const sentLabels = Object.entries(data.results || {})
        .filter(([, value]) => Boolean((value as { ok?: boolean }).ok))
        .map(([, value]) => (value as { label?: string }).label)
        .filter(Boolean);

      showToast(
        sentLabels.length
          ? `Alert sent to ${sentLabels.join(" and ")}`
          : data.message || "Alert sent",
        "success"
      );
      closeAppAlertModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send alert", "error");
    } finally {
      setSendingAppAlert(false);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page lg:h-screen lg:overflow-hidden">
      <div className="tf-dashboard flex min-h-0 flex-col lg:h-full">
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

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Active rules
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">{activeRules.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Recent triggers
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">{triggeredToday}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/90 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Tracked projects
            </p>
            <p className="mt-1.5 text-xl font-semibold text-text-primary sm:text-[22px]">{projects.length}</p>
          </div>
        </section>

        <section className="tf-filter-panel mt-6">
          <div className="tf-filter-grid md:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_180px_180px_170px_160px_132px]">
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
            <div className="flex items-end">
              <button
                type="button"
                className="tf-filter-reset w-full"
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
          </div>
        </section>

        <section className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="min-h-0 lg:flex lg:flex-col">
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

            <div className="mt-4 rounded-3xl border border-border bg-card/80 p-4 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
              <div className="tf-scroll-rail min-h-0 space-y-4 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
                {loading && (
                  <div className="rounded-2xl border border-border bg-card/90 p-6 text-sm text-text-secondary">
                    Loading alert rules...
                  </div>
                )}

                {!loading && !filteredRules.length && (
                  <div
                    className="rounded-2xl border border-border bg-card/90 p-6"
                  >
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
                  paginatedRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm"
                    >
                      <div className="gap-5 lg:grid lg:grid-cols-[minmax(0,1.4fr)_288px_168px] lg:items-start">
                        <div className="min-w-0">
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

                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                            <span>Last triggered {relativeTime(rule.lastTriggeredAt)}</span>
                            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                            <span>
                              Fired {rule._count.deliveries} time
                              {rule._count.deliveries === 1 ? "" : "s"}
                            </span>
                          </div>

                          {rule.issueDescription && (
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                              {rule.issueDescription}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:mt-0 lg:grid-cols-2">
                          <div className="rounded-xl border border-border bg-secondary/25 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                              Scope
                            </p>
                            <p className="mt-1 text-[13px] font-medium leading-5 text-text-primary">
                              {rule.project?.name ?? "All projects"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/25 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                              Environment
                            </p>
                            <p className="mt-1 text-[13px] font-medium leading-5 text-text-primary">
                              {rule.environment || "All environments"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/25 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                              Trigger
                            </p>
                            <p className="mt-1 text-[13px] font-medium leading-5 text-text-primary">
                              {rule.minOccurrences} occurrence{rule.minOccurrences > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/25 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                              Cooldown
                            </p>
                            <p className="mt-1 text-[13px] font-medium leading-5 text-text-primary">
                              {rule.cooldownMinutes} minutes
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex w-full flex-col gap-2.5 lg:mt-0 lg:min-w-[176px]">
                          {view === "active" ? (
                            <>
                              <button
                                type="button"
                                className="tf-button flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
                                onClick={() => sendAlertNotification(rule.id)}
                                disabled={notifyingRuleId === rule.id}
                              >
                                <LoadingButtonContent
                                  loading={notifyingRuleId === rule.id}
                                  loadingLabel="Sending..."
                                  idleLabel="Notify"
                                  icon={BellRing}
                                />
                              </button>
                              <button
                                type="button"
                                className="tf-button-ghost flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
                                onClick={() => void openAppAlertModal(rule)}
                              >
                                <Send className="h-4 w-4" />
                                Send alert
                              </button>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  className="tf-button-ghost inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-0 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                                  onClick={() =>
                                    updateRule(
                                      rule.id,
                                      { isActive: !rule.isActive },
                                      rule.isActive ? "Alert paused" : "Alert resumed"
                                    )
                                  }
                                  aria-label={rule.isActive ? "Pause alert" : "Resume alert"}
                                  title={rule.isActive ? "Pause alert" : "Resume alert"}
                                >
                                  {rule.isActive ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 px-0 text-red-400 transition hover:bg-red-500/15"
                                  onClick={() => setArchiveTarget(rule)}
                                  aria-label="Archive alert"
                                  title="Archive alert"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="tf-button-ghost inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
                                onClick={() => restoreRule(rule.id)}
                                disabled={restoringRuleId === rule.id}
                              >
                                <LoadingButtonContent
                                  loading={restoringRuleId === rule.id}
                                  loadingLabel="Restoring..."
                                  idleLabel="Restore alert"
                                  icon={RotateCcw}
                                />
                              </button>
                              <button
                                type="button"
                                className="tf-danger-button flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
                                onClick={() => setDeleteTarget(rule)}
                                disabled={deletingRuleId === rule.id}
                              >
                                <LoadingButtonContent
                                  loading={deletingRuleId === rule.id}
                                  loadingLabel="Deleting..."
                                  idleLabel="Delete"
                                />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {!loading && filteredRules.length > 5 && (
                <div className="rounded-2xl border border-border bg-card/90 px-4 py-4 shadow-sm">
                  <div className="tf-pagination-bar">
                    <div className="tf-pagination-size">
                      <select
                        className="tf-select tf-pagination-select w-full"
                        value={rulesPageSize}
                        onChange={(event) => {
                          setRulesPage(1);
                          setRulesPageSize(Number(event.target.value));
                        }}
                      >
                        <option value="6">6 / page</option>
                        <option value="12">12 / page</option>
                        <option value="18">18 / page</option>
                      </select>
                    </div>
                    <div className="tf-pagination-controls">
                      <button
                        type="button"
                        className="tf-pagination-button"
                        onClick={() => setRulesPage((current) => Math.max(1, current - 1))}
                        disabled={rulesPage === 1}
                      >
                        Prev
                      </button>
                      {visibleRulePages.map((pageNumber, index) => {
                        const previous = visibleRulePages[index - 1];
                        const showGap = previous && pageNumber - previous > 1;

                        return (
                          <div key={pageNumber} className="flex items-center gap-2">
                            {showGap && <span className="tf-pagination-gap">...</span>}
                            <button
                              type="button"
                              className={`tf-pagination-page ${
                                rulesPage === pageNumber
                                  ? "tf-pagination-page-active"
                                  : "tf-pagination-page-idle"
                              }`}
                              onClick={() => setRulesPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className="tf-pagination-button"
                        onClick={() =>
                          setRulesPage((current) => Math.min(rulesTotalPages, current + 1))
                        }
                        disabled={rulesPage >= rulesTotalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 lg:flex lg:flex-col">
            <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text-primary">Recent activity</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Latest alert deliveries and quick jumps into issues.
                  </p>
                </div>
                <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
                  {filteredEvents.length} events
                </span>
              </div>

              <div className="tf-scroll-rail mt-4 min-h-0 space-y-3 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
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
                  paginatedEvents.map((event) => (
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
                          className="inline-flex rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                          href={`/dashboard/errors/${event.error.id}`}
                        >
                          Open issue
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>

              {!loading && filteredEvents.length > 5 && (
                <DashboardPagination
                  page={eventsPage}
                  totalPages={eventsTotalPages}
                  pageSize={eventsPageSize}
                  pageSizeOptions={ALERT_EVENT_PAGE_SIZE_OPTIONS}
                  onPageChange={setEventsPage}
                  onPageSizeChange={(nextSize) => {
                    setEventsPage(1);
                    setEventsPageSize(nextSize);
                  }}
                  className="mt-4"
                  variant="compact"
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {appModalRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">Send alert</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Add an optional message, then choose where this alert should be sent. TraceForge will attach the alert details automatically.
            </p>

            <div className="mt-4 rounded-2xl border border-border bg-secondary/25 px-4 py-4">
              <p className="text-sm font-semibold text-text-primary">{appModalRule.name}</p>
              <p className="mt-1 text-sm text-text-secondary">
                {appModalRule.project?.name ?? "All projects"} · {appModalRule.environment || "All environments"} · {appModalRule.severity}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-text-primary">
                Message
              </label>
              <textarea
                className="tf-input min-h-[112px] w-full resize-y rounded-2xl py-3"
                placeholder="Add context for Slack or Jira recipients"
                value={appAlertMessage}
                onChange={(event) => setAppAlertMessage(event.target.value)}
                disabled={loadingAppTargets || sendingAppAlert}
              />
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-text-primary">Destinations</p>

              {loadingAppTargets ? (
                <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4 text-sm text-text-secondary">
                  Loading connected apps...
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border"
                      checked={sendToSlack}
                      onChange={(event) => setSendToSlack(event.target.checked)}
                      disabled={!appTargets?.targets.slack.ready || sendingAppAlert}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">
                        {appTargets?.targets.slack.label || "Slack"}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {appTargets?.targets.slack.ready
                          ? "Send this alert to the configured Slack channel."
                          : appTargets?.targets.slack.reason || "Slack is not ready for this alert."}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border"
                      checked={sendToJira}
                      onChange={(event) => setSendToJira(event.target.checked)}
                      disabled={!appTargets?.targets.jira.ready || sendingAppAlert}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">
                        {appTargets?.targets.jira.label || "Jira"}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {appTargets?.targets.jira.ready
                          ? "Create a Jira issue using the connected default project."
                          : appTargets?.targets.jira.reason || "Jira is not ready for this alert."}
                      </p>
                    </div>
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="tf-button-ghost px-4 py-2 text-sm"
                onClick={closeAppAlertModal}
                disabled={sendingAppAlert}
              >
                Close
              </button>
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={sendAppAlert}
                disabled={loadingAppTargets || sendingAppAlert}
              >
                <LoadingButtonContent
                  loading={sendingAppAlert}
                  loadingLabel="Sending alert..."
                  idleLabel="Send alert"
                  icon={Send}
                />
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="tf-button-ghost inline-flex h-10 w-28 shrink-0 items-center justify-center px-0 py-0 text-sm"
                onClick={() => setArchiveTarget(null)}
                disabled={archivingRuleId === archiveTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-28 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/12 px-0 py-0 text-sm font-semibold text-primary transition hover:bg-primary/18"
                onClick={archiveRule}
                disabled={archivingRuleId === archiveTarget.id}
              >
                <LoadingButtonContent
                  loading={archivingRuleId === archiveTarget.id}
                  loadingLabel="Archiving..."
                  idleLabel="Archive"
                  icon={Archive}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">Delete alert</h3>
            <p className="mt-2 text-sm text-text-secondary">
              This will permanently remove the archived alert rule and its delivery history.
            </p>
            <p className="mt-3 rounded-2xl border border-border bg-secondary/25 px-4 py-3 text-sm text-text-primary">
              {deleteTarget.name}
            </p>
            <div className="mt-5 flex w-full flex-nowrap items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost inline-flex h-10 min-w-0 flex-1 items-center justify-center px-3 py-0 text-sm sm:flex-none sm:px-4"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingRuleId === deleteTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-danger-solid inline-flex h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border px-3 py-0 text-sm font-semibold transition sm:flex-none sm:px-4"
                onClick={deleteRulePermanently}
                disabled={deletingRuleId === deleteTarget.id}
              >
                <LoadingButtonContent
                  loading={deletingRuleId === deleteTarget.id}
                  loadingLabel="Deleting..."
                  idleLabel="Delete"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-x-0 top-[73px] bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4 sm:inset-0 sm:items-center sm:px-6 sm:py-6">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:p-6 max-h-full overflow-y-auto sm:max-h-[calc(100dvh-3rem)]">
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

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  Issue description
                </label>
                <textarea
                  className="tf-input min-h-[108px] w-full resize-y rounded-2xl py-3"
                  placeholder="Describe the issue this alert should create when you trigger it manually."
                  value={issueDescription}
                  onChange={(event) => setIssueDescription(event.target.value)}
                />
                <p className="mt-2 text-xs text-text-secondary">
                  This description is used as the issue details when you manually notify from this
                  alert rule.
                </p>
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

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                <LoadingButtonContent loading={saving} loadingLabel="Creating..." idleLabel="Create alert" />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
