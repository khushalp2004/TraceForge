"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type User = {
  id: string;
  email: string;
};

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

const tokenKey = "traceforge_token";

export default function DashboardPage() {
  const { login, logout } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [frequency, setFrequency] = useState<AnalyticsPoint[]>([]);
  const [lastSeen, setLastSeen] = useState<AnalyticsPoint[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [search, setSearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [sortBy, setSortBy] = useState<"lastSeen" | "count">("lastSeen");
  const [days, setDays] = useState(30);

  useEffect(() => {
    const stored = localStorage.getItem(tokenKey);
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setOrgs([]);
      setProjects([]);
      setErrors([]);
      setFrequency([]);
      setLastSeen([]);
      setJoinRequests([]);
      setPendingInvites([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const projectsRes = await fetch(`${API_URL}/projects`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!projectsRes.ok) {
          throw new Error("Failed to load projects");
        }

        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);

        const orgsRes = await fetch(`${API_URL}/orgs`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!orgsRes.ok) {
          throw new Error("Failed to load orgs");
        }

        const orgsData = await orgsRes.json();
        setOrgs(orgsData.orgs || []);

        const requestsRes = await fetch(`${API_URL}/orgs/requests/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          setJoinRequests(requestsData.requests || []);
        }

        const invitesRes = await fetch(`${API_URL}/orgs/invites/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setPendingInvites(invitesData.invites || []);
        }

        const filteredProjects = projectsData.projects || [];
        const firstProject = filteredProjects[0];
        if (firstProject && !selectedProject) {
          setSelectedProject(firstProject.id);
        }

        const params = new URLSearchParams();
        if (selectedProject) params.set("projectId", selectedProject);
        if (search) params.set("q", search);
        if (environmentFilter) params.set("env", environmentFilter);
        if (sortBy) params.set("sort", sortBy);

        const errorsRes = await fetch(`${API_URL}/errors?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!errorsRes.ok) {
          throw new Error("Failed to load errors");
        }

        const errorsData = await errorsRes.json();
        setErrors(errorsData.errors || []);

        const analyticsParams = new URLSearchParams();
        if (selectedProject) analyticsParams.set("projectId", selectedProject);
        analyticsParams.set("days", String(days));

        const analyticsRes = await fetch(
          `${API_URL}/analytics?${analyticsParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!analyticsRes.ok) {
          throw new Error("Failed to load analytics");
        }

        const analyticsData = await analyticsRes.json();
        setFrequency(analyticsData.frequency || []);
        setLastSeen(analyticsData.lastSeen || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, selectedProject, refreshTick, search, environmentFilter, sortBy, days]);

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

  const handleAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      login(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

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

      setInviteEmail("");
    } catch (err) {
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

      setRefreshTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
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
  };

  const handleLogout = () => {
    logout();
    setToken(null);
    setUser(null);
    setOrgs([]);
    setProjects([]);
    setErrors([]);
    setPendingInvites([]);
  };

  if (!token) {
    return (
      <main className="tf-page pb-20 pt-16">
        <div className="tf-container max-w-md">
          <div className="tf-card p-8">
            <h1 className="text-2xl font-semibold text-text-primary">TraceForge Dashboard</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {authMode === "login" ? "Sign in to" : "Create an account to"} view your
              errors.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                className={`flex-1 tf-button ${authMode !== "login" ? "tf-button-ghost" : ""}`}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={`flex-1 tf-button ${authMode !== "register" ? "tf-button-ghost" : ""}`}
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <input
                className="tf-input w-full"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="tf-input w-full"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                className="w-full tf-button px-4 py-3 text-sm font-semibold"
                onClick={handleAuth}
                disabled={loading}
              >
                {loading
                  ? "Working..."
                  : authMode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>
              <Link className="tf-link text-sm" href="/forgot-password">
                Forgot password?
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const maxFrequency = Math.max(1, ...frequency.map((item) => item.count));
  const maxLastSeen = Math.max(1, ...lastSeen.map((item) => item.count));

  const linePath = (data: AnalyticsPoint[], maxValue: number) => {
    if (!data.length) return "";
    const width = 100;
    const height = 40;
    return data
      .map((point, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * width;
        const y = height - (point.count / maxValue) * height;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-text-primary">TraceForge</h1>
              <p className="text-sm text-text-secondary">{user?.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="relative rounded-full border border-border px-3 py-2 text-sm font-semibold text-text-secondary"
                onClick={() => setShowRequests((prev) => !prev)}
              >
                Notifications
                {joinRequests.length + pendingInvites.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                    {joinRequests.length + pendingInvites.length}
                  </span>
                )}
              </button>
              {showRequests && (
                <div className="absolute right-0 top-12 w-72 rounded-2xl bg-card p-4 shadow-lg border border-border">
                  <h3 className="text-sm font-semibold text-text-secondary">Join Requests</h3>
                  <div className="mt-3 space-y-3">
                    {joinRequests.map((req) => (
                      <div key={req.id} className="rounded-xl border border-border p-3 text-xs">
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
                        className="rounded-xl border border-border p-3 text-xs"
                      >
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
                </div>
              )}
              <button
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <select
                className="rounded-full border border-border px-4 py-2 text-sm text-text-primary"
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
              <input
                className="min-w-[180px] flex-1 rounded-full border border-border px-4 py-2 text-sm"
                placeholder="Search errors"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="rounded-full border border-border px-3 py-2 text-sm"
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
              >
                <option value="">All env</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
                <option value="browser">Browser</option>
              </select>
              <select
                className="rounded-full border border-border px-3 py-2 text-sm"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value === "count" ? "count" : "lastSeen")
                }
              >
                <option value="lastSeen">Last seen</option>
                <option value="count">Most frequent</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/orgs"
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Members
              </Link>
              <Link
                href="/dashboard/projects"
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Projects
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-6">
            <div className="tf-card p-6">
              <h2 className="text-sm font-semibold text-text-secondary">Projects</h2>
              <div className="mt-4 space-y-3">
                <select
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text-primary"
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                >
                  {displayedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {selectedProjectMeta && (
                  <div className="rounded-xl bg-secondary/70 px-4 py-3 text-xs text-text-secondary">
                    <p className="font-semibold text-text-secondary">API Key</p>
                    <p className="mt-1 break-all">{selectedProjectMeta.apiKey}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="tf-card p-6">
              <h2 className="text-sm font-semibold text-text-secondary">Create Project</h2>
              <p className="mt-2 text-xs text-text-secondary">
                {selectedOrg ? `Org: ${selectedOrg.name}` : "Personal project"}
              </p>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder="Project name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
                <button
                  className="w-full tf-button px-4 py-2 text-sm font-semibold"
                  onClick={handleProjectCreate}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Project"}
                </button>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            </div>

            <div className="tf-card p-6">
              <h2 className="text-sm font-semibold text-text-secondary">Organizations</h2>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder="Org name"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
                <button
                  className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary"
                  onClick={handleOrgCreate}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Organization"}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder="Invite email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <select
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value === "OWNER" ? "OWNER" : "MEMBER")
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button
                  className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary"
                  onClick={handleInvite}
                  disabled={loading}
                >
                  {loading ? "Inviting..." : "Invite Member"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="tf-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Analytics</h2>
                  <p className="text-sm text-text-secondary">Last {days} days</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    value={days}
                    onChange={(event) => setDays(Number(event.target.value))}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  <button
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary"
                    onClick={() => setRefreshTick((value) => value + 1)}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                    Error Frequency
                  </p>
                  <svg className="mt-4 h-16 w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d={linePath(frequency, maxFrequency)}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="mt-2 flex justify-between text-[10px] text-text-secondary">
                    <span>{frequency[0]?.date.slice(5) || ""}</span>
                    <span>{frequency[frequency.length - 1]?.date.slice(5) || ""}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                    Errors Last Seen
                  </p>
                  <svg className="mt-4 h-16 w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d={linePath(lastSeen, maxLastSeen)}
                      fill="none"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="mt-2 flex justify-between text-[10px] text-text-secondary">
                    <span>{lastSeen[0]?.date.slice(5) || ""}</span>
                    <span>{lastSeen[lastSeen.length - 1]?.date.slice(5) || ""}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="tf-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-text-primary">Recent Errors</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    placeholder="Search errors"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    value={environmentFilter}
                    onChange={(event) => setEnvironmentFilter(event.target.value)}
                  >
                    <option value="">All env</option>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                    <option value="browser">Browser</option>
                  </select>
                  <select
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value === "count" ? "count" : "lastSeen")
                    }
                  >
                    <option value="lastSeen">Last seen</option>
                    <option value="count">Most frequent</option>
                  </select>
                </div>
              </div>

              {loading && <p className="mt-4 text-sm text-text-secondary">Loading...</p>}
              {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

              <div className="mt-6 space-y-4">
                {errors.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/errors/${item.id}`}
                    className="block rounded-xl border border-border px-4 py-4 transition hover:border-primary/30 hover:bg-accent-soft"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{item.message}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Last seen {new Date(item.lastSeen).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-text-primary">
                        {item.count} hits
                      </span>
                    </div>
                    {item.analysis?.aiExplanation && (
                      <p className="mt-3 text-sm text-text-secondary">
                        AI: {item.analysis.aiExplanation}
                      </p>
                    )}
                  </Link>
                ))}
                {!loading && !errors.length && (
                  <p className="text-sm text-text-secondary">No errors yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
