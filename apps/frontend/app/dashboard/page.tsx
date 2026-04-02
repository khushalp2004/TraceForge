"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Dices } from "lucide-react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAuth } from "../../context/AuthContext";
import { useLayout } from "../../context/LayoutContext";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { SparkAreaChart } from "./components/SparkAreaChart";
import { DashboardPagination } from "./components/DashboardPagination";
import { LAYOUTS } from "../layoutPreference";
import { THEMES } from "../theme";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const NOTIFICATIONS_URL = `${API_URL}/notifications/stream`;
const dismissedAlertNotificationsKey = "traceforge_dismissed_alert_notifications";
const dismissedJoinRequestsKey = "traceforge_dismissed_join_requests";
const dismissedInviteNotificationsKey = "traceforge_dismissed_invite_notifications";
const postAuthToastKey = "traceforge_post_auth_toast";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";
type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type JoinRequest = {
  id: string;
  orgId: string;
  orgName: string;
  requesterEmail: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type PendingInvite = {
  token: string;
  orgId: string;
  orgName: string;
  role: "OWNER" | "MEMBER";
  expiresAt: string;
};

type AlertNotification = {
  kind: "rule" | "event";
  id: string;
  message: string;
  environment: string | null;
  triggeredAt: string;
  project: {
    id: string;
    name: string;
  };
  error: {
    id?: string;
  };
  alertRule: {
    id: string;
    name: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
  };
};

type RealtimeAlertPayload = {
  type: "alert.triggered" | "alert.created" | "alert.deleted";
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  ruleId?: string;
  errorId?: string;
  environment?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
};

const isRealtimeAlertPayload = (value: unknown): value is RealtimeAlertPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return type === "alert.triggered" || type === "alert.created" || type === "alert.deleted";
};

type AlertRuleNotificationResponse = {
  id: string;
  name: string;
  environment: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
  project: {
    id: string;
    name: string;
  } | null;
};

type Project = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  orgId?: string | null;
};

type ErrorItem = {
  id: string;
  projectId: string;
  message: string;
  stackTrace: string;
  count: number;
  lastSeen: string;
  analysis?: {
    aiExplanation: string;
  } | null;
};

type AnalyticsPoint = {
  date: string;
  count: number;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type InviteLinkStatus = {
  valid: boolean;
  trialsUsed: number;
  trialsRemaining: number;
  orgName?: string;
  reason?: string;
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-secondary/70 ${className ?? ""}`} />
);

const severityForMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("null") || lower.includes("undefined") || lower.includes("typeerror")) {
    return "critical";
  }
  if (lower.includes("timeout") || lower.includes("rate") || lower.includes("network")) {
    return "warning";
  }
  return "info";
};

const SeverityTag = ({ severity }: { severity: "critical" | "warning" | "info" }) => {
  const styles =
    severity === "critical"
      ? "tf-danger-tag"
      : severity === "warning"
      ? "tf-warning-tag"
      : "tf-muted-tag";
  const label = severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Info";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { logout, user: authUser, token, isReady } = useAuth();
  const { layout, setLayout } = useLayout();
  const { theme, setTheme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout = isDesktop ? layout : "classic";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [recentErrorsPagination, setRecentErrorsPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 1
  });
  const [frequency, setFrequency] = useState<AnalyticsPoint[]>([]);
  const [lastSeen, setLastSeen] = useState<AnalyticsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [search, setSearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [sortBy, setSortBy] = useState<"lastSeen" | "count">("lastSeen");
  const [days, setDays] = useState(30);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const diceTimerRef = useRef<number | null>(null);
  const [chartVariant, setChartVariant] = useState<"area" | "bar">("area");
  const [toast, setToast] = useState<Toast | null>(null);
  const [inviteTokenFromUrl, setInviteTokenFromUrl] = useState("");
  const [inviteLinkStatus, setInviteLinkStatus] = useState<InviteLinkStatus | null>(null);
  const [dismissedJoinRequestIds, setDismissedJoinRequestIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const dismissed = window.localStorage.getItem(dismissedJoinRequestsKey);
    if (!dismissed) {
      return [];
    }

    try {
      return JSON.parse(dismissed) as string[];
    } catch {
      window.localStorage.removeItem(dismissedJoinRequestsKey);
      return [];
    }
  });
  const [dismissedInviteTokens, setDismissedInviteTokens] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const dismissed = window.localStorage.getItem(dismissedInviteNotificationsKey);
    if (!dismissed) {
      return [];
    }

    try {
      return JSON.parse(dismissed) as string[];
    } catch {
      window.localStorage.removeItem(dismissedInviteNotificationsKey);
      return [];
    }
  });
  const [dismissedAlertNotificationIds, setDismissedAlertNotificationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const dismissed = window.localStorage.getItem(dismissedAlertNotificationsKey);
    if (!dismissed) {
      return [];
    }

    try {
      return JSON.parse(dismissed) as string[];
    } catch {
      window.localStorage.removeItem(dismissedAlertNotificationsKey);
      return [];
    }
  });
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const inviteStatusToastRef = useRef<string | null>(null);
  const prefsHydratedRef = useRef(false);
  const deferredSearch = useDebouncedValue(search.trim(), 300);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      prefsHydratedRef.current = false;
      return;
    }

    if (!prefsHydratedRef.current) {
      prefsHydratedRef.current = true;
      try {
        const raw = window.localStorage.getItem(dashboardPrefsKey);
        if (!raw) return;
        const prefs = JSON.parse(raw) as {
          orgId?: string;
          projectId?: string;
          environment?: string;
          sortBy?: "lastSeen" | "count";
          days?: number;
          chartVariant?: "area" | "bar";
        };

        if (typeof prefs.orgId === "string") setSelectedOrgId(prefs.orgId);
        if (typeof prefs.projectId === "string") setSelectedProject(prefs.projectId);
        if (typeof prefs.environment === "string") setEnvironmentFilter(prefs.environment);
        if (prefs.sortBy === "lastSeen" || prefs.sortBy === "count") setSortBy(prefs.sortBy);
        if (prefs.days === 7 || prefs.days === 14 || prefs.days === 30) setDays(prefs.days);
        if (prefs.chartVariant === "area" || prefs.chartVariant === "bar") setChartVariant(prefs.chartVariant);
      } catch {
        // Ignore malformed prefs.
      }
      return;
    }

    window.localStorage.setItem(
      dashboardPrefsKey,
      JSON.stringify({
        orgId: selectedOrgId,
        projectId: selectedProject,
        environment: environmentFilter,
        sortBy,
        days,
        chartVariant
      })
    );
  }, [token, selectedOrgId, selectedProject, environmentFilter, sortBy, days, chartVariant]);

  useEffect(() => {
    return () => {
      if (diceTimerRef.current) {
        window.clearTimeout(diceTimerRef.current);
      }
    };
  }, []);

  const rollStyle = () => {
    if (diceTimerRef.current) {
      window.clearTimeout(diceTimerRef.current);
    }

    setDiceRolling(true);
    diceTimerRef.current = window.setTimeout(() => setDiceRolling(false), 720);

    const availableThemes = THEMES.map((item) => item.id).filter((id) => id !== theme);
    const availableLayouts = LAYOUTS.map((item) => item.id).filter((id) => id !== layout);

    const nextTheme =
      availableThemes[Math.floor(Math.random() * Math.max(availableThemes.length, 1))] || theme;
    const nextLayout =
      availableLayouts[Math.floor(Math.random() * Math.max(availableLayouts.length, 1))] || layout;

    setTheme(nextTheme);
    setLayout(nextLayout);
  };

  useEffect(() => {
    if (!isReady || !token || typeof window === "undefined") {
      return;
    }

    const storedToast = window.sessionStorage.getItem(postAuthToastKey);
    if (!storedToast) {
      return;
    }

    try {
      const parsed = JSON.parse(storedToast) as Toast;
      if (parsed?.message && parsed?.tone) {
        showToast(parsed.message, parsed.tone);
      }
    } catch {
      // Ignore invalid stored toast payloads.
    } finally {
      window.sessionStorage.removeItem(postAuthToastKey);
    }
  }, [isReady, token]);

  const inviteTrialsLabel = (status: InviteLinkStatus | null) => {
    const remaining = status?.trialsRemaining ?? 2;
    if (remaining === 1) {
      return "1 trial remaining";
    }
    return `${remaining} trials remaining`;
  };

  const persistDismissedAlertNotifications = (ids: string[]) => {
    setDismissedAlertNotificationIds(ids);
    localStorage.setItem(dismissedAlertNotificationsKey, JSON.stringify(ids));
  };

  const persistDismissedJoinRequests = (ids: string[]) => {
    setDismissedJoinRequestIds(ids);
    localStorage.setItem(dismissedJoinRequestsKey, JSON.stringify(ids));
  };

  const persistDismissedInviteNotifications = (tokens: string[]) => {
    setDismissedInviteTokens(tokens);
    localStorage.setItem(dismissedInviteNotificationsKey, JSON.stringify(tokens));
  };

  const loadNotifications = async (authToken: string) => {
    try {
      const [requestsRes, invitesRes, alertRulesRes, alertEventsRes] = await Promise.all([
        fetch(`${API_URL}/orgs/requests/pending`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_URL}/orgs/invites/pending`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_URL}/alerts/rules`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_URL}/alerts/events?includeTests=true`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      ]);

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setJoinRequests(
          (requestsData.requests || []).filter(
            (request: JoinRequest) => !dismissedJoinRequestIds.includes(request.id)
          )
        );
      }

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setPendingInvites(
          (invitesData.invites || []).filter(
            (invite: PendingInvite) => !dismissedInviteTokens.includes(invite.token)
          )
        );
      }

      if (alertRulesRes.ok && alertEventsRes.ok) {
        const [alertRulesData, alertEventsData] = await Promise.all([
          alertRulesRes.json(),
          alertEventsRes.json()
        ]);

        setAlertNotifications((prev) => {
          const ruleNotifications = ((alertRulesData.rules || []) as AlertRuleNotificationResponse[]).map(
            (rule) =>
              ({
                kind: "rule",
                id: `rule:${rule.id}`,
                message: `Alert created for ${rule.project?.name ?? "all projects"}`,
                environment: rule.environment,
                triggeredAt: rule.createdAt,
                project: {
                  id: rule.project?.id || "",
                  name: rule.project?.name || "All projects"
                },
                error: {},
                alertRule: {
                  id: rule.id,
                  name: rule.name,
                  severity: rule.severity
                }
              }) satisfies AlertNotification
          );

          const eventNotifications = ((alertEventsData.events || []) as AlertNotification[]).map(
            (event) =>
              ({
                ...event,
                kind: "event"
              }) satisfies AlertNotification
          );

          const incoming = [...ruleNotifications, ...eventNotifications];
          const merged = [...incoming, ...prev];
          const unique = merged.filter(
            (item, index, list) => list.findIndex((entry) => entry.id === item.id) === index
          );
          return unique
            .filter((item) => !dismissedAlertNotificationIds.includes(item.id))
            .sort(
              (a, b) =>
                new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
            )
            .slice(0, 5);
        });
      }
    } catch {
      // Keep the dashboard interactive even if notifications cannot refresh.
    }
  };

  useEffect(() => {
    setAlertNotifications((prev) =>
      prev.filter((item) => !dismissedAlertNotificationIds.includes(item.id))
    );
  }, [dismissedAlertNotificationIds]);

  useEffect(() => {
    setJoinRequests((prev) =>
      prev.filter((item) => !dismissedJoinRequestIds.includes(item.id))
    );
  }, [dismissedJoinRequestIds]);

  useEffect(() => {
    setPendingInvites((prev) =>
      prev.filter((item) => !dismissedInviteTokens.includes(item.token))
    );
  }, [dismissedInviteTokens]);

  useEffect(() => {
    setInviteTokenFromUrl(searchParams.get("inviteToken") || "");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("notifications") !== "open") {
      return;
    }

    setShowRequests(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notifications");
    params.delete("focus");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard");
  }, [router, searchParams]);

  useEffect(() => {
    if (!token || !inviteTokenFromUrl) {
      setInviteLinkStatus(null);
      inviteStatusToastRef.current = null;
      return;
    }

    const loadInviteStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/orgs/invites/status/${inviteTokenFromUrl}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        const status = (data.status ?? null) as InviteLinkStatus | null;
        setInviteLinkStatus(status);

        if (status && !status.valid && inviteStatusToastRef.current !== inviteTokenFromUrl) {
          inviteStatusToastRef.current = inviteTokenFromUrl;
          showToast("This invite link is expired or no longer valid", "error");
        }
      } catch {
        setInviteLinkStatus(null);
      }
    };

    void loadInviteStatus();
  }, [token, inviteTokenFromUrl]);

  useEffect(() => {
    if (!token) {
      setOrgs([]);
      setProjects([]);
      setErrors([]);
      setFrequency([]);
      setLastSeen([]);
      setJoinRequests([]);
      setPendingInvites([]);
      setAlertNotifications([]);
      setNotificationsExpanded(false);
      setDashboardLoading(false);
      return;
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    const loadWorkspaceData = async () => {
      setError(null);

      try {
        const [projectsRes, orgsRes] = await Promise.all([
          fetch(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }),
          fetch(`${API_URL}/orgs`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          })
        ]);

        if (!projectsRes.ok) {
          throw new Error("Failed to load projects");
        }

        if (!orgsRes.ok) {
          throw new Error("Failed to load orgs");
        }

        const [projectsData, orgsData] = await Promise.all([projectsRes.json(), orgsRes.json()]);

        if (!controller.signal.aborted) {
          setProjects(projectsData.projects || []);
          setOrgs(orgsData.orgs || []);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    };

    void loadWorkspaceData();
    void loadNotifications(token);

    return () => controller.abort();
  }, [token, refreshTick]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    const loadErrors = async () => {
      setDashboardLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedProject) params.set("projectId", selectedProject);
        if (deferredSearch) params.set("q", deferredSearch);
        if (environmentFilter) params.set("env", environmentFilter);
        if (sortBy) params.set("sort", sortBy);
        params.set("page", String(recentErrorsPagination.page));
        params.set("pageSize", String(recentErrorsPagination.pageSize));

        const errorsRes = await fetch(`${API_URL}/errors?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });

        if (!errorsRes.ok) {
          throw new Error("Failed to load errors");
        }

        const errorsData = await errorsRes.json();

        if (!controller.signal.aborted) {
          setErrors(errorsData.errors || []);
          setRecentErrorsPagination((prev) => ({
            page: errorsData.pagination?.page || prev.page,
            pageSize: errorsData.pagination?.pageSize || prev.pageSize,
            total: errorsData.pagination?.total || 0,
            totalPages: errorsData.pagination?.totalPages || 1
          }));
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        if (!controller.signal.aborted) {
          setDashboardLoading(false);
        }
      }
    };

    void loadErrors();

    return () => controller.abort();
  }, [
    token,
    selectedProject,
    deferredSearch,
    environmentFilter,
    sortBy,
    recentErrorsPagination.page,
    recentErrorsPagination.pageSize,
    refreshTick
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    const loadAnalytics = async () => {
      try {
        const analyticsParams = new URLSearchParams();
        if (selectedProject) analyticsParams.set("projectId", selectedProject);
        analyticsParams.set("days", String(days));

        const analyticsRes = await fetch(`${API_URL}/analytics?${analyticsParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });

        if (!analyticsRes.ok) {
          throw new Error("Failed to load analytics");
        }

        const analyticsData = await analyticsRes.json();

        if (!controller.signal.aborted) {
          setFrequency(analyticsData.frequency || []);
          setLastSeen(analyticsData.lastSeen || []);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    };

    void loadAnalytics();

    return () => controller.abort();
  }, [token, selectedProject, days, refreshTick]);

  useEffect(() => {
    setRecentErrorsPagination((prev) => ({ ...prev, page: 1 }));
  }, [selectedProject, deferredSearch, environmentFilter, sortBy]);

  useEffect(() => {
    setShowApiKey(false);
  }, [selectedProject]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 30000);
    return () => window.clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const stream = new EventSource(
      `${NOTIFICATIONS_URL}?token=${encodeURIComponent(token)}`
    );

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;

        if (
          payload &&
          typeof payload === "object" &&
          "type" in payload &&
          (payload as { type?: unknown }).type === "connected"
        ) {
          return;
        }

        const payloadRuleId = isRealtimeAlertPayload(payload) ? payload.ruleId : undefined;

        if (isRealtimeAlertPayload(payload) && payload.type === "alert.deleted" && payloadRuleId) {
          setAlertNotifications((prev) =>
            prev.filter((item) => item.id !== `rule:${payloadRuleId}`)
          );
        }

        if (
          isRealtimeAlertPayload(payload) &&
          payload.type === "alert.created" &&
          payloadRuleId &&
          payload.message
        ) {
          const ruleId = payloadRuleId;
          setAlertNotifications((prev) => {
            const nextItem: AlertNotification = {
              kind: "rule",
              id: `rule:${ruleId}`,
              message: payload.message,
              environment: payload.environment ?? null,
              triggeredAt: payload.createdAt,
              project: {
                id: payload.projectId || "",
                name: payload.projectName || "All projects"
              },
              error: {},
              alertRule: {
                id: ruleId,
                name: payload.title || "Alert created",
                severity: payload.severity ?? "CRITICAL"
              }
            };

            const filtered = prev.filter((item) => item.id !== nextItem.id);
            if (dismissedAlertNotificationIds.includes(nextItem.id)) {
              return filtered;
            }
            return [nextItem, ...filtered]
              .sort(
                (a, b) =>
                  new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
              )
              .slice(0, 5);
          });
        }

        if (
          isRealtimeAlertPayload(payload) &&
          payload.type === "alert.triggered" &&
          payload.message
        ) {
          setAlertNotifications((prev) => {
            const nextItem: AlertNotification = {
              kind: "event",
              id: `${payload.ruleId || "alert"}:${payload.errorId || payload.message}:${payload.createdAt}`,
              message: payload.message,
              environment: payload.environment ?? null,
              triggeredAt: payload.createdAt,
              project: {
                id: payload.projectId || "",
                name: payload.projectName || "Organization project"
              },
              error: {
                id: payload.errorId
              },
              alertRule: {
                id: payload.ruleId || payload.createdAt,
                name: payload.title || "Alert triggered",
                severity: payload.severity ?? "CRITICAL"
              }
            };

            const filtered = prev.filter((item) => item.id !== nextItem.id);
            if (dismissedAlertNotificationIds.includes(nextItem.id)) {
              return filtered;
            }
            return [nextItem, ...filtered]
              .sort(
                (a, b) =>
                  new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
              )
              .slice(0, 5);
          });
        }

        if (!isRealtimeAlertPayload(payload)) {
          void loadNotifications(token);
        }
      } catch {
        // Ignore malformed keepalive or connection events.
      }
    };

    return () => {
      stream.close();
    };
  }, [token, dismissedAlertNotificationIds]);

  useEffect(() => {
    if (!showRequests) return;
    const handleClick = (event: MouseEvent) => {
      if (!notificationsRef.current) return;
      if (!notificationsRef.current.contains(event.target as Node)) {
        setShowRequests(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRequests]);

  const selectedProjectMeta = useMemo(() => {
    return projects.find((project) => project.id === selectedProject) || null;
  }, [projects, selectedProject]);

  const displayedProjects = useMemo(() => {
    if (!selectedOrgId) {
      return projects.filter((project) => !project.orgId);
    }
    return projects.filter((project) => project.orgId === selectedOrgId);
  }, [projects, selectedOrgId]);

  const selectedOrg = orgs.find((org) => org.id === selectedOrgId) || null;

  const handleProjectCreate = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: projectName, orgId: selectedOrgId || undefined })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjectName("");
      setProjects((prev) => [data.project, ...prev]);
      setSelectedProject(data.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleOrgCreate = async () => {
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/orgs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: orgName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create org");
      }

      setOrgName("");
      setOrgs((prev) => [data.org, ...prev]);
      setSelectedOrgId(data.org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedOrgId) {
      setError("Select an organization to invite members");
      return;
    }

    if (!inviteEmail.trim()) {
      setError("Invite email is required");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrgId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      showToast(`Invite sent to ${inviteEmail.trim()}`, "success");
      setInviteEmail("");
    } catch (err) {
      showToast("Failed to send invite", "error");
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (tokenValue: string) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/invites/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: tokenValue })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      setPendingInvites((prev) => prev.filter((invite) => invite.token !== tokenValue));
      setInviteTokenFromUrl((current) => (current === tokenValue ? "" : current));
      setInviteLinkStatus(null);
      if (searchParams.get("inviteToken") === tokenValue) {
        router.replace("/dashboard");
      }
      showToast(
        data.status === "pending" ? "Approval request sent to the owner" : "Invite accepted",
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      if (
        message.includes("expired") ||
        message.includes("not found") ||
        message.includes("already used both approval attempts")
      ) {
        setInviteLinkStatus((current) =>
          current
            ? { ...current, valid: false, trialsRemaining: 0, trialsUsed: Math.max(2, current.trialsUsed) }
            : { valid: false, trialsUsed: 2, trialsRemaining: 0 }
        );
        showToast("This invite link is expired or no longer valid", "error");
      } else {
        showToast(message, "error");
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (id: string, action: "approve" | "reject") => {
    if (!token) return;

    await fetch(`${API_URL}/orgs/requests/${id}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    setJoinRequests((prev) => prev.filter((req) => req.id !== id));
    setDismissedJoinRequestIds((prev) => prev.filter((requestId) => requestId !== id));
  };

  const handleLogout = () => {
    logout();
    setOrgs([]);
    setProjects([]);
    setErrors([]);
    setPendingInvites([]);
    router.replace("/signin");
  };

  const dismissJoinRequestNotification = (id: string) => {
    const next = Array.from(new Set([...dismissedJoinRequestIds, id]));
    persistDismissedJoinRequests(next);
    setJoinRequests((prev) => prev.filter((req) => req.id !== id));
  };

  const dismissInviteNotification = (tokenValue: string) => {
    const next = Array.from(new Set([...dismissedInviteTokens, tokenValue]));
    persistDismissedInviteNotifications(next);
    setPendingInvites((prev) => prev.filter((invite) => invite.token !== tokenValue));
  };

  const dismissAlertNotification = (id: string) => {
    const next = Array.from(new Set([...dismissedAlertNotificationIds, id]));
    persistDismissedAlertNotifications(next);
    setAlertNotifications((prev) => prev.filter((alert) => alert.id !== id));
  };

  useEffect(() => {
    if (!showRequests) return;
    const handleClick = (event: MouseEvent) => {
      if (!notificationsRef.current) return;
      if (!notificationsRef.current.contains(event.target as Node)) {
        setShowRequests(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRequests]);

  if (!isReady || !token) {
    return (
      <main className="tf-page tf-dashboard-page">
        <div className="tf-container max-w-md">
          <div className="tf-card p-8">
            <div className="h-6 w-32 animate-pulse rounded-full bg-secondary/70" />
            <div className="mt-4 h-10 w-52 animate-pulse rounded-2xl bg-secondary/70" />
            <div className="mt-8 space-y-4">
              <div className="h-32 animate-pulse rounded-3xl bg-secondary/70" />
              <div className="h-32 animate-pulse rounded-3xl bg-secondary/70" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const totalErrors = recentErrorsPagination.total;
  const isInitialLoading = dashboardLoading && !projects.length && !errors.length;
  const isTopbarLayout = effectiveLayout === "topbar";
  const isCompactLayout = effectiveLayout === "compact";
  const frequencyTotal = frequency.reduce((sum, item) => sum + item.count, 0);
  const frequencyPeak = Math.max(0, ...frequency.map((item) => item.count));
  const frequencyAvg = Math.round(frequencyTotal / Math.max(1, frequency.length));
  const lastSeenTotal = lastSeen.reduce((sum, item) => sum + item.count, 0);
  const lastSeenPeak = Math.max(0, ...lastSeen.map((item) => item.count));
  const lastSeenAvg = Math.round(lastSeenTotal / Math.max(1, lastSeen.length));

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Dashboard
              </p>
              <Link href="/" className="inline-block">
                <h1 className="tf-title mt-2 text-3xl">TraceForge</h1>
              </Link>
              <p className="text-sm text-text-secondary">{authUser?.email}</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                onClick={rollStyle}
                className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-text-secondary shadow-sm transition hover:border-primary/40 hover:bg-secondary/70 hover:text-text-primary"
                aria-label="Surprise me (random theme + layout)"
              >
                <Dices className={`h-4 w-4 transition ${diceRolling ? "tf-dice-roll" : "group-hover:rotate-12"}`} />
                <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-text-secondary opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
                  Surprise me: random theme + layout
                </span>
              </button>
              <div className="relative" ref={notificationsRef}>
                <button
                  className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/90 px-3 sm:gap-2.5 sm:px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm transition hover:border-primary/40 hover:bg-secondary/70 hover:text-text-primary"
                  onClick={() => setShowRequests((prev) => !prev)}
                  aria-label="Notifications"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary/80 text-text-secondary">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
                    </svg>
                  </span>
                  <span className="hidden sm:inline">Notifications</span>
                  {joinRequests.length + pendingInvites.length + alertNotifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm sm:static sm:px-2.5 sm:text-xs">
                      {joinRequests.length + pendingInvites.length + alertNotifications.length}
                    </span>
                  )}
                </button>
                {showRequests && (
                  <div
                    className={`absolute right-0 top-full z-30 mt-3 rounded-2xl border border-border bg-card p-4 shadow-lg max-[639px]:fixed max-[639px]:left-4 max-[639px]:right-4 max-[639px]:top-[5.5rem] max-[639px]:mt-0 max-[639px]:w-auto max-[639px]:max-w-none ${
                      notificationsExpanded ? "w-[28rem]" : "w-72"
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary sm:inline-flex"
                          onClick={() => setNotificationsExpanded((value) => !value)}
                        >
                          {notificationsExpanded ? "Collapse" : "Expand"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                          onClick={() => {
                            const nextIds = Array.from(
                              new Set([
                                ...dismissedAlertNotificationIds,
                                ...alertNotifications.map((alert) => alert.id)
                              ])
                            );
                            persistDismissedAlertNotifications(nextIds);
                            setAlertNotifications([]);
                          }}
                          disabled={!alertNotifications.length}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div
                      className={`overflow-y-auto pr-1 ${
                        notificationsExpanded ? "max-h-[32rem]" : "max-h-80"
                      }`}
                    >
                      <h3 className="text-sm font-semibold text-text-secondary">Join Requests</h3>
                      <div className="mt-3 space-y-3">
                        {joinRequests.map((req) => (
                          <div key={req.id} className="relative rounded-xl border border-border p-3 pr-11 text-xs">
                            <button
                              type="button"
                              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                              onClick={() => dismissJoinRequestNotification(req.id)}
                              aria-label="Dismiss join request notification"
                            >
                              <svg
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              >
                                <path d="M4 4l8 8" />
                                <path d="M12 4 4 12" />
                              </svg>
                            </button>
                            <p className="font-semibold text-text-primary">{req.requesterEmail}</p>
                            <p className="text-text-secondary">{req.orgName}</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="rounded-full border border-border px-2 py-1 text-xs"
                                onClick={() => handleRequestAction(req.id, "approve")}
                              >
                                Approve
                              </button>
                              <button
                                className="rounded-full border border-red-200 px-2 py-1 text-xs text-red-600"
                                onClick={() => handleRequestAction(req.id, "reject")}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                        {!joinRequests.length && (
                          <p className="text-xs text-text-secondary">No pending requests.</p>
                        )}
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-text-secondary">Invites</h3>
                      <div className="mt-3 space-y-3">
                        {pendingInvites.map((invite) => (
                          <div
                            key={invite.token}
                            className="relative rounded-xl border border-border p-3 pr-11 text-xs"
                          >
                            <button
                              type="button"
                              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                              onClick={() => dismissInviteNotification(invite.token)}
                              aria-label="Dismiss invite notification"
                            >
                              <svg
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              >
                                <path d="M4 4l8 8" />
                                <path d="M12 4 4 12" />
                              </svg>
                            </button>
                            <p className="font-semibold text-text-primary">{invite.orgName}</p>
                            <p className="text-text-secondary">Role: {invite.role.toLowerCase()}</p>
                            <p className="text-text-secondary">
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="rounded-full border border-border px-2 py-1 text-xs"
                                onClick={() => handleAcceptInvite(invite.token)}
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}
                        {!pendingInvites.length && (
                          <p className="text-xs text-text-secondary">No pending invites.</p>
                        )}
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-text-secondary">Alerts</h3>
                      <div className="mt-3 space-y-3">
                        {alertNotifications.map((alert) => (
                          <div key={alert.id} className="relative rounded-xl border border-border p-3 pr-11 text-xs">
                            <button
                              type="button"
                              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                              onClick={() => dismissAlertNotification(alert.id)}
                              aria-label="Dismiss alert notification"
                            >
                              <svg
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              >
                                <path d="M4 4l8 8" />
                                <path d="M12 4 4 12" />
                              </svg>
                            </button>
                            <p className="font-semibold text-text-primary">
                              {alert.alertRule.name}
                            </p>
                            <p className="mt-1 text-text-secondary">{alert.message}</p>
                            <p className="mt-1 text-text-secondary">
                              {alert.project.name}
                              {alert.environment ? ` · ${alert.environment}` : ""}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Link
                                className="rounded-full border border-border px-2 py-1 text-xs"
                                href="/dashboard/issues"
                                onClick={() => setShowRequests(false)}
                              >
                                Open issues
                              </Link>
                            </div>
                          </div>
                        ))}
                        {!alertNotifications.length && (
                          <p className="text-xs text-text-secondary">No recent alerts.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                className="tf-danger-button inline-flex items-center gap-2 rounded-full border bg-card/90 px-4 py-2 text-sm font-semibold shadow-sm transition"
                onClick={handleLogout}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>

          {inviteTokenFromUrl &&
            inviteLinkStatus?.valid !== false &&
            inviteLinkStatus?.reason === "request_approval" && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {inviteLinkStatus?.orgName
                      ? `Team invite for ${inviteLinkStatus.orgName}`
                      : "Team invite detected"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    This link sends an approval request to the owner.
                  </p>
                  <p className="mt-1 text-xs font-medium text-text-secondary">
                    {inviteTrialsLabel(inviteLinkStatus)}
                  </p>
                </div>
                <button
                  className="tf-button px-4 py-2 text-sm"
                  onClick={() => handleAcceptInvite(inviteTokenFromUrl)}
                  disabled={loading}
                >
                  {loading ? "Working..." : "Request approval"}
                </button>
              </div>
            </div>
          )}

          <div className="tf-filter-panel">
            <div className="tf-filter-header">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Workspace filters</h2>
                <p className="tf-filter-help">
                  Switch org scope, search recent issues, and narrow results before jumping into details.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="tf-filter-reset"
                  onClick={() => {
                    setSelectedOrgId("");
                    setSelectedProject("");
                    setSearch("");
                    setEnvironmentFilter("");
                    setSortBy("lastSeen");
                  }}
                >
                  Reset filters
                </button>
              </div>
            </div>
            <div className="tf-filter-grid sm:grid-cols-2 xl:grid-cols-[220px_minmax(0,1.4fr)_190px_180px_auto]">
              <label className="tf-filter-field">
                <span className="tf-filter-label">Organization</span>
                <select
                  className="tf-select tf-filter-control max-[639px]:w-full"
                  value={selectedOrgId}
                  onChange={(event) => {
                    setSelectedOrgId(event.target.value);
                    setSelectedProject("");
                  }}
                >
                  <option value="">Personal</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.role.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>
              <label className="tf-filter-field">
                <span className="tf-filter-label">Search</span>
                <input
                  className="tf-input tf-filter-control !h-10 min-h-[2.5rem] flex-1 !py-0 leading-none sm:min-w-[180px] max-[639px]:basis-full max-[639px]:w-full"
                  placeholder="Search errors"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="tf-filter-field">
                <span className="tf-filter-label">Environment</span>
                <select
                  className="tf-select tf-filter-control max-[639px]:w-full"
                  value={environmentFilter}
                  onChange={(event) => setEnvironmentFilter(event.target.value)}
                >
                  <option value="">All env</option>
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                  <option value="browser">Browser</option>
                </select>
              </label>
              <label className="tf-filter-field">
                <span className="tf-filter-label">Sort by</span>
                <select
                  className="tf-select tf-filter-control max-[639px]:w-full"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value === "count" ? "count" : "lastSeen")
                  }
                >
                  <option value="lastSeen">Last seen</option>
                  <option value="count">Most frequent</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <Link
                  href="/dashboard/orgs"
                  className="tf-filter-reset"
                >
                  Organizations
                </Link>
                <Link
                  href="/dashboard/projects"
                  className="tf-filter-reset"
                >
                  Projects
                </Link>
              </div>
            </div>
            <div className="tf-filter-pills">
              <span className="tf-filter-pill">
                Scope: {selectedOrg ? selectedOrg.name : "Personal"}
              </span>
              <span className="tf-filter-pill">
                {environmentFilter || "All environments"}
              </span>
              <span className="tf-filter-pill">
                {sortBy === "count" ? "Most frequent first" : "Latest first"}
              </span>
            </div>
          </div>
        </header>

        <section className="grid gap-6">
          {error && !dashboardLoading && (
            <div className="rounded-2xl border border-border bg-card/90 p-4 text-sm text-text-secondary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <button
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary"
                  onClick={() => setRefreshTick((value) => value + 1)}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <div className="tf-card overflow-hidden p-5">
            {isInitialLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Projects", value: displayedProjects.length },
                  { label: "Total errors", value: totalErrors },
                  { label: "Organizations", value: orgs.length }
                ].map((stat) => (
                  <div key={stat.label} className="min-w-0 rounded-xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs font-semibold text-text-secondary">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold text-text-primary">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tf-card overflow-hidden p-5" id="analytics">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-secondary">Project</h2>
                <p className="text-xs text-text-secondary">
                  Select a project to reveal its API key and shortcuts.
                </p>
              </div>
              <Link
                href="/dashboard/projects"
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
              >
                Manage projects
              </Link>
            </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                className="tf-select min-w-0 w-full flex-1 sm:min-w-[180px]"
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
              >
                <option value="">Select a project</option>
                {displayedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {selectedProjectMeta && (
                <button
                  className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text-secondary"
                  onClick={() => setShowApiKey((value) => !value)}
                >
                  {showApiKey ? "Hide key" : "Show key"}
                </button>
              )}
            </div>
            {selectedProjectMeta && showApiKey && (
              <div className="mt-3 rounded-xl bg-secondary/70 px-3 py-2 text-xs text-text-secondary">
                <p className="font-semibold text-text-secondary">API Key</p>
                <p className="mt-1 break-all">{selectedProjectMeta.apiKey}</p>
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/70 p-3">
                <p className="text-xs font-semibold text-text-secondary">Create Project</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="tf-input min-w-0 flex-1"
                    placeholder="Project name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                  />
                  <button
                    className="tf-button px-4 py-2 text-sm font-semibold"
                    onClick={handleProjectCreate}
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/70 p-3">
                <p className="text-xs font-semibold text-text-secondary">Create Organization</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="tf-input min-w-0 flex-1"
                    placeholder="Organization name"
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                  />
                  <button
                    className="tf-button-ghost px-4 py-2 text-sm font-semibold"
                    onClick={handleOrgCreate}
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </div>

          <div
            className={
              isTopbarLayout
                ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-start"
                : isCompactLayout
                ? "grid gap-6 lg:grid-cols-2 lg:items-start"
                : "space-y-6"
            }
          >
            <div className="tf-card overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Analytics</h2>
                  <p className="text-sm text-text-secondary">Last {days} days</p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                  <div className="inline-flex items-center rounded-full border border-border bg-card/90 p-1 text-xs font-semibold text-text-secondary shadow-sm">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 transition ${
                        chartVariant === "area"
                          ? "bg-accent-soft text-text-primary"
                          : "hover:bg-secondary/70 hover:text-text-primary"
                      }`}
                      onClick={() => setChartVariant("area")}
                      aria-label="Line chart view"
                    >
                      Line
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 transition ${
                        chartVariant === "bar"
                          ? "bg-accent-soft text-text-primary"
                          : "hover:bg-secondary/70 hover:text-text-primary"
                      }`}
                      onClick={() => setChartVariant("bar")}
                      aria-label="Bar chart view"
                    >
                      Bar
                    </button>
                  </div>
                  <select
                    className="tf-select min-w-0 max-[639px]:flex-1"
                    value={days}
                    onChange={(event) => setDays(Number(event.target.value))}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  <button
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary max-[639px]:flex-1"
                    onClick={() => setRefreshTick((value) => value + 1)}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-border bg-card/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                        Error Frequency
                      </p>
                      <p className="mt-1 break-words text-xs text-text-secondary">Total {frequencyTotal} · Avg {frequencyAvg}/day · Peak {frequencyPeak}</p>
                    </div>
                    <Link
                      href="/dashboard/insights"
                      className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    >
                      Insights
                    </Link>
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-3">
                    <SparkAreaChart
                      data={frequency}
                      tone="primary"
                      height={96}
                      unitLabel="events"
                      variant={chartVariant}
                      showXAxis={false}
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-text-secondary">
                      <span>{frequency[0]?.date.slice(5) || ""}</span>
                      <span>{frequency[frequency.length - 1]?.date.slice(5) || ""}</span>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-border bg-card/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                        Errors Last Seen
                      </p>
                      <p className="mt-1 break-words text-xs text-text-secondary">Total {lastSeenTotal} · Avg {lastSeenAvg}/day · Peak {lastSeenPeak}</p>
                    </div>
                    <Link
                      href="/dashboard/issues"
                      className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    >
                      Issues
                    </Link>
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-3">
                    <SparkAreaChart
                      data={lastSeen}
                      tone="muted"
                      height={96}
                      unitLabel="issues"
                      variant={chartVariant}
                      showXAxis={false}
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-text-secondary">
                      <span>{lastSeen[0]?.date.slice(5) || ""}</span>
                      <span>{lastSeen[lastSeen.length - 1]?.date.slice(5) || ""}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`tf-card p-6 ${
                isTopbarLayout ? "lg:sticky lg:top-24 lg:self-start" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-text-primary">Recent Errors</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-1">
                    {environmentFilter ? environmentFilter : "All env"}
                  </span>
                  <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-1">
                    {sortBy === "count" ? "Most frequent" : "Last seen"}
                  </span>
                </div>
              </div>

              {dashboardLoading && <p className="mt-4 text-sm text-text-secondary">Loading...</p>}

              <div
                className={`mt-6 space-y-4 ${
                  isTopbarLayout ? "max-h-[60vh] overflow-auto pr-1 tf-scroll-rail" : ""
                }`}
              >
                {errors.map((item) => {
                  const severity = severityForMessage(item.message);
                  const isExpanded = expandedErrorId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border px-4 py-4 transition hover:border-primary/30 hover:bg-accent-soft"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityTag severity={severity} />
                            <p className="break-words text-sm font-semibold text-text-primary">{item.message}</p>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            Last seen {new Date(item.lastSeen).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-text-primary">
                            {item.count} hits
                          </span>
                          <Link
                            href={`/dashboard/errors/${item.id}`}
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary"
                          >
                            View
                          </Link>
                          <button
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary"
                            onClick={() =>
                              setExpandedErrorId(isExpanded ? null : item.id)
                            }
                          >
                            {isExpanded ? "Hide stack" : "Show stack"}
                          </button>
                        </div>
                      </div>
                      {item.analysis?.aiExplanation && (
                        <p className="mt-3 text-sm text-text-secondary">
                          AI: {item.analysis.aiExplanation}
                        </p>
                      )}
                      {isExpanded && item.stackTrace && (
                        <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-ink p-3 text-xs text-white/90">
                          {item.stackTrace}
                        </pre>
                      )}
                    </div>
                  );
                })}
                {!dashboardLoading && !errors.length && (
                  <div className="rounded-2xl border border-border bg-card/90 p-6 text-center">
                    <p className="text-sm font-semibold text-text-primary">No errors yet</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Create a project and send your first exception to see live issues here.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <Link className="tf-button px-4 py-2 text-sm" href="/dashboard/projects">
                        Create project
                      </Link>
                      <Link className="tf-button-ghost px-4 py-2 text-sm" href="/docs">
                        Read docs
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {!dashboardLoading && recentErrorsPagination.total > 5 && (
                <DashboardPagination
                  page={recentErrorsPagination.page}
                  totalPages={recentErrorsPagination.totalPages}
                  pageSize={recentErrorsPagination.pageSize}
                  pageSizeOptions={[
                    { value: 5, label: "5 / page" },
                    { value: 10, label: "10 / page" },
                    { value: 20, label: "20 / page" }
                  ]}
                  onPageChange={(page) =>
                    setRecentErrorsPagination((prev) => ({
                      ...prev,
                      page
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setRecentErrorsPagination((prev) => ({
                      ...prev,
                      page: 1,
                      pageSize
                    }))
                  }
                  className="mt-5"
                  variant={isDesktop ? "full" : "compact"}
                />
              )}
            </div>
          </div>
        </section>
      </div>
      {toast && (
        <div
          className="tf-dashboard-toast"
          style={{
            background: toast.tone === "success" ? "#16a34a" : "#dc2626"
          }}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
