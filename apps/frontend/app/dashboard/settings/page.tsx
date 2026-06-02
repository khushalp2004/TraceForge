"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  plan: "FREE" | "DEV" | "PRO" | "TEAM";
  createdAt: string;
};

type User = {
  id: string;
  email: string;
  plan: "FREE" | "DEV" | "PRO";
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

type GithubRepo = {
  id: string;
  fullName: string;
  private: boolean;
  url: string;
};

type GithubIntegrationState = {
  configured: boolean;
  connected: boolean;
  status?: "error";
  error?: string;
  account?: {
    id?: string | null;
    name?: string | null;
    login?: string | null;
  };
  repos?: GithubRepo[];
  selectedRepoIds?: string[];
};

type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

type SlackIntegrationState = {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  error?: string;
  workspace?: {
    id?: string | null;
    name?: string | null;
  };
  channels?: SlackChannel[];
  selectedChannelId?: string;
  selectedChannelName?: string;
};

type JiraSite = {
  id: string;
  name: string;
  url: string;
};

type JiraProject = {
  id: string;
  key: string;
  name: string;
};

type JiraIntegrationState = {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  error?: string;
  sites?: JiraSite[];
  projects?: JiraProject[];
  selectedSiteId?: string;
  selectedProjectId?: string;
  selectedProjectKey?: string;
  selectedProjectName?: string;
};

const settingsCardClass = "min-w-0 overflow-hidden rounded-2xl border border-border bg-card/95 p-5 shadow-sm";
const subtlePanelClass = "min-w-0 overflow-hidden rounded-xl border border-border bg-secondary/20 p-4";
const compactPanelClass = "min-w-0 overflow-hidden rounded-xl border border-border bg-secondary/20 p-4";
const setupStateClass =
  "mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-secondary/20 px-4 py-4 text-sm text-text-secondary";
const settingsSelectClass = "tf-select tf-filter-control w-full";

const integrationStatusMeta = (connected: boolean) =>
  connected
    ? {
        label: "Connected",
        className:
          "inline-flex w-fit max-w-full items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"
      }
    : {
        label: "Not connected",
        className:
          "inline-flex w-fit max-w-full items-center rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-xs font-semibold text-text-secondary"
      };

const integrationTone = (connected: boolean) =>
  connected ? "text-text-primary" : "text-text-secondary";

export default function SettingsPage() {
  const prefsHydratedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [toast, setToast] = useState<Toast | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [github, setGithub] = useState<GithubIntegrationState | null>(null);
  const [slack, setSlack] = useState<SlackIntegrationState | null>(null);
  const [jira, setJira] = useState<JiraIntegrationState | null>(null);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [selectedSlackChannelId, setSelectedSlackChannelId] = useState("");
  const [selectedJiraSiteId, setSelectedJiraSiteId] = useState("");
  const [selectedJiraProjectId, setSelectedJiraProjectId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const selectedOrg = useMemo(
    () => orgs.find((org) => org.id === selectedOrgId) || null,
    [orgs, selectedOrgId]
  );
  const selectedJiraSite = useMemo(
    () => (jira?.sites || []).find((site) => site.id === (selectedJiraSiteId || jira?.selectedSiteId)) || null,
    [jira, selectedJiraSiteId]
  );

  const connectedCount = [github?.connected, slack?.connected, jira?.connected].filter(Boolean).length;

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("integrationStatus");
    const message = searchParams.get("integrationMessage");
    const orgIdFromQuery = searchParams.get("orgId");

    if (!integration || !status) {
      return;
    }

    if (orgIdFromQuery) {
      setSelectedOrgId(orgIdFromQuery);
    }

    showToast(
      message ||
        (status === "connected"
          ? `${integration.charAt(0).toUpperCase()}${integration.slice(1)} connected`
          : `${integration.charAt(0).toUpperCase()}${integration.slice(1)} connection failed`),
      status === "connected" ? "success" : "error"
    );

    router.replace("/dashboard/settings");
  }, [router, searchParams]);

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
    } finally {
      prefsHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
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

  useEffect(() => {
    if (!github?.error) return;
    showToast(github.error, "error");
  }, [github?.error]);

  useEffect(() => {
    if (!slack?.error) return;
    showToast(slack.error, "error");
  }, [slack?.error]);

  useEffect(() => {
    if (!jira?.error) return;
    showToast(jira.error, "error");
  }, [jira?.error]);

  const getToken = () => window.localStorage.getItem(tokenKey) || "";

  const authedFetch = async (path: string, init?: RequestInit) => {
    const token = getToken();
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
  };

  const loadOrgsAndUser = async () => {
    setOrgsLoading(true);
    try {
      const [orgsRes, userRes] = await Promise.all([
        authedFetch("/orgs"),
        authedFetch("/auth/me")
      ]);
      const orgData = await orgsRes.json();
      const userData = await userRes.json();
      
      if (!orgsRes.ok) {
        throw new Error(orgData.error || "Failed to load organizations");
      }
      if (!userRes.ok) {
        throw new Error(userData.error || "Failed to load user");
      }

      setUser(userData.user);

      const nextOrgs = (orgData.orgs || []) as Org[];
      setOrgs(nextOrgs);
      if (!selectedOrgId && nextOrgs[0]) {
        setSelectedOrgId(nextOrgs[0].id);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load organizations", "error");
    } finally {
      setOrgsLoading(false);
    }
  };

  const loadGithub = async () => {
    try {
      const res = await authedFetch("/integrations/github");
      const data = (await res.json()) as GithubIntegrationState & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load GitHub integration");
      }
      setGithub(data);
      setSelectedRepoIds(data.selectedRepoIds || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load GitHub", "error");
    }
  };

  const loadSlack = async (orgId: string) => {
    if (!orgId) {
      setSlack(null);
      return;
    }

    try {
      const res = await authedFetch(`/integrations/slack?orgId=${encodeURIComponent(orgId)}`);
      const data = (await res.json()) as SlackIntegrationState & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Slack integration");
      }
      setSlack(data);
      setSelectedSlackChannelId(data.selectedChannelId || "");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load Slack", "error");
    }
  };

  const loadJira = async (orgId: string, siteId?: string) => {
    if (!orgId) {
      setJira(null);
      return;
    }

    try {
      const params = new URLSearchParams({ orgId });
      if (siteId) {
        params.set("siteId", siteId);
      }

      const res = await authedFetch(`/integrations/jira?${params.toString()}`);
      const data = (await res.json()) as JiraIntegrationState & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Jira integration");
      }
      setJira(data);
      setSelectedJiraSiteId(data.selectedSiteId || "");
      setSelectedJiraProjectId(data.selectedProjectId || "");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load Jira", "error");
    }
  };

  useEffect(() => {
    void loadOrgsAndUser();
    void loadGithub();
  }, []);

  useEffect(() => {
    if (!selectedOrgId) {
      setSlack(null);
      setJira(null);
      return;
    }

    void Promise.all([loadSlack(selectedOrgId), loadJira(selectedOrgId)]);
  }, [selectedOrgId]);

  const redirectToOAuth = async (
    path: string,
    actionKey: string,
    body?: Record<string, unknown>
  ) => {
    setLoadingAction(actionKey);
    try {
      const res = await authedFetch(path, {
        method: "POST",
        body: JSON.stringify(body || {})
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start connection");
      }
      window.location.assign(data.url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to start connection", "error");
      setLoadingAction(null);
    }
  };

  const saveGithubRepos = async () => {
    setLoadingAction("github-save");
    try {
      const res = await authedFetch("/integrations/github/repos", {
        method: "PATCH",
        body: JSON.stringify({ selectedRepoIds })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save repositories");
      }
      showToast("GitHub repositories saved", "success");
      await loadGithub();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save repositories", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const disconnectGithub = async () => {
    setLoadingAction("github-disconnect");
    try {
      const res = await authedFetch("/integrations/github", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disconnect GitHub");
      }
      showToast("GitHub disconnected", "success");
      await loadGithub();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to disconnect GitHub", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const saveSlackChannel = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("slack-save");
    try {
      const res = await authedFetch("/integrations/slack/channel", {
        method: "PATCH",
        body: JSON.stringify({
          orgId: selectedOrgId,
          channelId: selectedSlackChannelId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save Slack channel");
      }
      showToast("Slack channel saved", "success");
      await loadSlack(selectedOrgId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save Slack channel", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const sendSlackTest = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("slack-test");
    try {
      const res = await authedFetch("/integrations/slack/test", {
        method: "POST",
        body: JSON.stringify({ orgId: selectedOrgId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send Slack test");
      }
      showToast("Slack test sent", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to send Slack test", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const disconnectSlack = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("slack-disconnect");
    try {
      const res = await authedFetch("/integrations/slack", {
        method: "DELETE",
        body: JSON.stringify({ orgId: selectedOrgId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disconnect Slack");
      }
      showToast("Slack disconnected", "success");
      await loadSlack(selectedOrgId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to disconnect Slack", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const saveJiraConfig = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("jira-save");
    try {
      const res = await authedFetch("/integrations/jira/config", {
        method: "PATCH",
        body: JSON.stringify({
          orgId: selectedOrgId,
          siteId: selectedJiraSiteId,
          projectId: selectedJiraProjectId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save Jira project");
      }
      showToast("Jira project saved", "success");
      await loadJira(selectedOrgId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save Jira project", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const disconnectJira = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("jira-disconnect");
    try {
      const res = await authedFetch("/integrations/jira", {
        method: "DELETE",
        body: JSON.stringify({ orgId: selectedOrgId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disconnect Jira");
      }
      showToast("Jira disconnected", "success");
      await loadJira(selectedOrgId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to disconnect Jira", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const sendJiraTest = async () => {
    if (!selectedOrgId) return;
    setLoadingAction("jira-test");
    try {
      const res = await authedFetch("/integrations/jira/test", {
        method: "POST",
        body: JSON.stringify({ orgId: selectedOrgId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Jira test issue");
      }
      showToast(
        data.issue?.key
          ? `Jira test issue created: ${data.issue.key}`
          : "Jira test issue created",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create Jira test issue",
        "error"
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page overflow-x-hidden">
      <div className="tf-dashboard">
        <header className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="tf-kicker">Settings</p>
            <div className="mt-2 flex items-center">
              <h1 className="font-display text-2xl font-semibold text-text-primary">
                Workspace Integrations
              </h1>
              <PageDescriptionPopover>
                Connect the tools your team already uses, then choose the repos, channels, and projects TraceForge should use.
              </PageDescriptionPopover>
            </div>
          </div>
          
          <div className="flex shrink-0 flex-col sm:items-end">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Settings Scope
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm min-w-[200px]">
              <select
                className="bg-transparent text-sm font-semibold text-text-primary outline-none w-full"
                value={selectedOrgId}
                onChange={(event) => setSelectedOrgId(event.target.value)}
                disabled={orgsLoading}
              >
                <option value="">Personal workspace</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex items-center justify-end h-4">
              {selectedOrg && (
                <span className="tf-muted-tag text-[10px] py-0.5 px-2">
                  Role: {selectedOrg.role === "OWNER" ? "Owner" : "Member"}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="tf-divider my-6" />

        <div className="grid gap-6">
          <section className={settingsCardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">GitHub</h2>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  Connect one personal GitHub account, then keep the repos you care about selected.
                </p>
              </div>
              <span className={integrationStatusMeta(Boolean(github?.connected)).className}>
                {integrationStatusMeta(Boolean(github?.connected)).label}
              </span>
            </div>

            {!github?.configured ? (
              <div className={setupStateClass}>
                Add GitHub OAuth env values first, then connect your account here.
              </div>
            ) : !github?.connected ? (
              <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-semibold text-text-primary">Connect your GitHub account</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      We’ll import your repositories after OAuth, then you can choose which ones TraceForge should keep for release context.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                    onClick={() => void redirectToOAuth("/auth/github/integration/start", "github-connect")}
                    disabled={loadingAction === "github-connect"}
                  >
                    {loadingAction === "github-connect" ? (
                      <LoadingButtonContent
                        loading
                        loadingLabel="Connecting GitHub..."
                        idleLabel="Connect GitHub"
                      />
                    ) : (
                      "Connect GitHub"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-border bg-secondary/20 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {github.account?.name || "GitHub account"}
                      </p>
                      <p className="mt-1 break-all text-sm text-text-secondary">
                        {github.account?.login ? `Connected as @${github.account.login}` : "Connected"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">{selectedRepoIds.length} selected</span>
                      {github.error ? <span className="tf-warning-tag">Needs attention</span> : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className={compactPanelClass}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Repositories
                      </p>
                      <p className="mt-2 text-lg font-semibold text-text-primary">{github.repos?.length || 0}</p>
                    </div>
                    <div className={compactPanelClass}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Selected
                      </p>
                      <p className="mt-2 text-lg font-semibold text-text-primary">{selectedRepoIds.length}</p>
                    </div>
                    <div className={compactPanelClass}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Scope
                      </p>
                      <p className="mt-2 text-lg font-semibold text-text-primary">Personal</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void disconnectGithub()}
                      disabled={loadingAction === "github-disconnect"}
                    >
                      {loadingAction === "github-disconnect" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Disconnecting..."
                          idleLabel="Disconnect"
                        />
                      ) : (
                        "Disconnect"
                      )}
                    </button>
                    <button
                      type="button"
                      className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void saveGithubRepos()}
                      disabled={loadingAction === "github-save"}
                    >
                      {loadingAction === "github-save" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Saving repos..."
                          idleLabel="Save repos"
                        />
                      ) : (
                        "Save repos"
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Choose repositories</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Keep only the repos you want TraceForge to use for release context and ownership.
                      </p>
                    </div>
                    <span className="text-sm font-medium text-text-secondary">{selectedRepoIds.length} selected</span>
                  </div>

                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {(github.repos || []).map((repo) => {
                      const checked = selectedRepoIds.includes(repo.id);
                      return (
                        <label
                          key={repo.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 text-sm text-text-primary transition hover:bg-card group/repo"
                        >
                          <div className="relative flex items-center p-1 -ml-1">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={checked}
                              onChange={(event) => {
                                setSelectedRepoIds((current) =>
                                  event.target.checked
                                    ? [...current, repo.id]
                                    : current.filter((value) => value !== repo.id)
                                );
                              }}
                            />
                            <div className={`h-4 w-4 rounded-[4px] border transition-all flex items-center justify-center ${checked ? "border-brand-primary bg-brand-primary text-white" : "border-text-secondary/50 bg-transparent group-hover/repo:border-text-secondary/80"}`}>
                              {checked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-all font-medium sm:truncate">{repo.fullName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                              <span>{repo.private ? "Private" : "Public"}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="min-w-0 grid gap-6 xl:grid-cols-2 items-stretch">
            <div className={`${settingsCardClass} h-full flex flex-col`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">Slack</h2>
                    <span className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Workspace</span>
                    <span className={integrationStatusMeta(Boolean(slack?.connected)).className}>
                      {integrationStatusMeta(Boolean(slack?.connected)).label}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-text-secondary">
                    Route workspace alerts into one default Slack channel.
                  </p>
                </div>
              </div>

              {!selectedOrg ? (
                <div className={setupStateClass}>
                  Choose an organization first to manage Slack delivery.
                </div>
              ) : !slack?.configured ? (
                <div className={setupStateClass}>
                  Add Slack OAuth env values first, then connect this workspace.
                </div>
              ) : user?.plan === "FREE" && selectedOrg.plan !== "TEAM" ? (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <p className="text-sm font-semibold text-text-primary">Upgrade to connect Slack</p>
                    <p className="mt-1 break-words text-sm text-text-secondary">
                      Slack integration is only available on paid plans. Upgrade to Pro or Team to enable alert delivery to Slack.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/billing"
                    className="tf-button w-full px-4 py-2 text-sm sm:w-auto text-center"
                  >
                    View Plans
                  </Link>
                </div>
              ) : !slack?.connected ? (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="max-w-xl break-words text-sm text-text-secondary">
                    Connect Slack once for this organization, then choose the default channel used for alert delivery.
                  </p>
                  <button
                    type="button"
                    className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                    onClick={() =>
                      void redirectToOAuth("/integrations/slack/start", "slack-connect", {
                        orgId: selectedOrgId
                      })
                    }
                    disabled={selectedOrg.role !== "OWNER" || loadingAction === "slack-connect"}
                  >
                    {loadingAction === "slack-connect" ? (
                      <LoadingButtonContent
                        loading
                        loadingLabel="Connecting Slack..."
                        idleLabel="Connect Slack"
                      />
                    ) : (
                      "Connect Slack"
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-4 flex-1">
                  <div className={subtlePanelClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Current setup</p>
                        <p className="mt-1 break-words text-sm text-text-secondary">
                          {slack.selectedChannelName
                            ? "Slack is ready to deliver alerts into your selected channel."
                            : "Choose a default channel for alert delivery."}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-text-secondary max-w-full break-words text-right">
                        {slack.workspace?.name || "Workspace"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={compactPanelClass}>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Slack workspace
                      </label>
                      <p className="text-sm font-semibold text-text-primary">
                        {slack.workspace?.name || "Slack workspace"}
                      </p>
                      <p className="mt-1 break-words text-sm text-text-secondary">
                        Connected for {selectedOrg.name}.
                      </p>
                    </div>

                    <div className={compactPanelClass}>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Default channel
                      </label>
                      <select
                        value={selectedSlackChannelId}
                        onChange={(event) => setSelectedSlackChannelId(event.target.value)}
                        className={settingsSelectClass}
                        disabled={selectedOrg.role !== "OWNER"}
                      >
                        <option value="">Choose a channel</option>
                        {(slack.channels || []).map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.isPrivate ? "🔒 " : "#"}
                            {channel.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-auto pt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void disconnectSlack()}
                      disabled={selectedOrg.role !== "OWNER" || loadingAction === "slack-disconnect"}
                    >
                      {loadingAction === "slack-disconnect" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Disconnecting..."
                          idleLabel="Disconnect"
                        />
                      ) : (
                        "Disconnect"
                      )}
                    </button>
                    <button
                      type="button"
                      className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void sendSlackTest()}
                      disabled={selectedOrg.role !== "OWNER" || loadingAction === "slack-test"}
                    >
                      {loadingAction === "slack-test" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Sending test..."
                          idleLabel="Send test"
                        />
                      ) : (
                        "Send test"
                      )}
                    </button>
                    <button
                      type="button"
                      className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void saveSlackChannel()}
                      disabled={
                        selectedOrg.role !== "OWNER" ||
                        !selectedSlackChannelId ||
                        loadingAction === "slack-save"
                      }
                    >
                      {loadingAction === "slack-save" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Saving channel..."
                          idleLabel="Save channel"
                        />
                      ) : (
                        "Save channel"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`${settingsCardClass} h-full flex flex-col`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">Jira</h2>
                    <span className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Workspace</span>
                    <span className={integrationStatusMeta(Boolean(jira?.connected)).className}>
                      {integrationStatusMeta(Boolean(jira?.connected)).label}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-text-secondary">
                    Connect Jira once, then pick the site and default project used by this workspace.
                  </p>
                </div>
              </div>

              {!selectedOrg ? (
                <div className={setupStateClass}>
                  Choose an organization first to manage Jira routing.
                </div>
              ) : !jira?.configured ? (
                <div className={setupStateClass}>
                  Add Jira OAuth env values first, then connect this workspace.
                </div>
              ) : user?.plan === "FREE" && selectedOrg.plan !== "TEAM" ? (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <p className="text-sm font-semibold text-text-primary">Upgrade to connect Jira</p>
                    <p className="mt-1 break-words text-sm text-text-secondary">
                      Jira integration is only available on paid plans. Upgrade to Pro or Team to enable issue creation in Jira.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/billing"
                    className="tf-button w-full px-4 py-2 text-sm sm:w-auto text-center"
                  >
                    View Plans
                  </Link>
                </div>
              ) : !jira?.connected ? (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="max-w-xl break-words text-sm text-text-secondary">
                    Connect Jira for this organization, then choose the site and default project TraceForge should use.
                  </p>
                  <button
                    type="button"
                    className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                    onClick={() =>
                      void redirectToOAuth("/integrations/jira/start", "jira-connect", {
                        orgId: selectedOrgId
                      })
                    }
                    disabled={selectedOrg.role !== "OWNER" || loadingAction === "jira-connect"}
                  >
                    {loadingAction === "jira-connect" ? (
                      <LoadingButtonContent
                        loading
                        loadingLabel="Connecting Jira..."
                        idleLabel="Connect Jira"
                      />
                    ) : (
                      "Connect Jira"
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-4 flex-1">
                  <div className={subtlePanelClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Current setup</p>
                        <p className="mt-1 break-words text-sm text-text-secondary">
                          {jira.selectedProjectName
                            ? "Jira is ready to create issues in your selected project."
                            : "Choose a site and default project for Jira issue creation."}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-text-secondary max-w-full break-words text-right">
                        {selectedJiraSite?.name || "No site selected"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={compactPanelClass}>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Jira site
                      </label>
                      <select
                        value={selectedJiraSiteId}
                        onChange={(event) => {
                          const nextSiteId = event.target.value;
                          setSelectedJiraSiteId(nextSiteId);
                          setSelectedJiraProjectId("");
                          if (selectedOrgId) {
                            void loadJira(selectedOrgId, nextSiteId);
                          }
                        }}
                        className={settingsSelectClass}
                        disabled={selectedOrg.role !== "OWNER"}
                      >
                        <option value="">Choose a site</option>
                        {(jira.sites || []).map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={compactPanelClass}>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Default project
                      </label>
                      <select
                        value={selectedJiraProjectId}
                        onChange={(event) => setSelectedJiraProjectId(event.target.value)}
                        className={settingsSelectClass}
                        disabled={selectedOrg.role !== "OWNER"}
                      >
                        <option value="">Choose a project</option>
                        {(jira.projects || []).map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.key} · {project.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 break-words text-sm text-text-secondary">
                        {jira.selectedProjectName
                          ? `${jira.selectedProjectKey} · ${jira.selectedProjectName}`
                          : "No default project selected yet"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void disconnectJira()}
                      disabled={selectedOrg.role !== "OWNER" || loadingAction === "jira-disconnect"}
                    >
                      {loadingAction === "jira-disconnect" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Disconnecting..."
                          idleLabel="Disconnect"
                        />
                      ) : (
                        "Disconnect"
                      )}
                    </button>
                    <button
                      type="button"
                      className="tf-button-ghost w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void sendJiraTest()}
                      disabled={selectedOrg.role !== "OWNER" || loadingAction === "jira-test"}
                    >
                      {loadingAction === "jira-test" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Sending test..."
                          idleLabel="Send test"
                        />
                      ) : (
                        "Send test"
                      )}
                    </button>
                    <button
                      type="button"
                      className="tf-button w-full px-4 py-2 text-sm sm:w-auto"
                      onClick={() => void saveJiraConfig()}
                      disabled={
                        selectedOrg.role !== "OWNER" ||
                        !selectedJiraSiteId ||
                        !selectedJiraProjectId ||
                        loadingAction === "jira-save"
                      }
                    >
                      {loadingAction === "jira-save" ? (
                        <LoadingButtonContent
                          loading
                          loadingLabel="Saving project..."
                          idleLabel="Save project"
                        />
                      ) : (
                        "Save project"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={settingsCardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary">Coming next</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  PagerDuty stays next in line after GitHub, Slack, and Jira are fully exercised with real accounts.
                </p>
              </div>
              <span className="tf-muted-tag">Next up</span>
            </div>
          </section>
        </div>
      </div>

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
