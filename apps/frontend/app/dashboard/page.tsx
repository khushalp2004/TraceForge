"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

      localStorage.setItem(tokenKey, data.token);
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
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setOrgs([]);
    setProjects([]);
    setErrors([]);
    setPendingInvites([]);
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-ink">TraceForge Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">
            {authMode === "login" ? "Sign in to" : "Create an account to"} view your
            errors.
          </p>

          <div className="mt-6 flex gap-2">
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                authMode === "login"
                  ? "bg-amber-500 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                authMode === "register"
                  ? "bg-amber-500 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              className="w-full rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-white"
              onClick={handleAuth}
              disabled={loading}
            >
              {loading
                ? "Working..."
                : authMode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
            <Link className="text-sm text-amber-600" href="/forgot-password">
              Forgot password?
            </Link>
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
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">TraceForge</h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              className="relative rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              onClick={() => setShowRequests((prev) => !prev)}
            >
              Notifications
              {joinRequests.length + pendingInvites.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {joinRequests.length + pendingInvites.length}
                </span>
              )}
            </button>
            {showRequests && (
              <div className="absolute right-0 top-12 w-72 rounded-2xl bg-white p-4 shadow-lg border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-600">Join Requests</h3>
                <div className="mt-3 space-y-3">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="rounded-xl border border-slate-100 p-3 text-xs">
                      <p className="font-semibold text-slate-700">{req.requesterEmail}</p>
                      <p className="text-slate-500">{req.orgName}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs"
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
                    <p className="text-xs text-slate-400">No pending requests.</p>
                  )}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-600">Invites</h3>
                <div className="mt-3 space-y-3">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.token}
                      className="rounded-xl border border-slate-100 p-3 text-xs"
                    >
                      <p className="font-semibold text-slate-700">{invite.orgName}</p>
                      <p className="text-slate-500">Role: {invite.role.toLowerCase()}</p>
                      <p className="text-slate-400">
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                          onClick={() => handleAcceptInvite(invite.token)}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                  {!pendingInvites.length && (
                    <p className="text-xs text-slate-400">No pending invites.</p>
                  )}
                </div>
              </div>
            )}
            <select
              className="rounded-full border border-slate-200 px-4 py-2 text-sm"
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
            <Link
              href="/dashboard/orgs"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Manage Members
            </Link>
            <Link
              href="/dashboard/projects"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Project Settings
            </Link>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500">Projects</h2>
              <div className="mt-4 space-y-3">
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-500">API Key</p>
                    <p className="mt-1 break-all">{selectedProjectMeta.apiKey}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500">Create Project</h2>
              <p className="mt-2 text-xs text-slate-400">
                {selectedOrg ? `Org: ${selectedOrg.name}` : "Personal project"}
              </p>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Project name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
                <button
                  className="w-full rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleProjectCreate}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Project"}
                </button>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500">Organizations</h2>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Org name"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
                <button
                  className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={handleOrgCreate}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Organization"}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Invite email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value === "OWNER" ? "OWNER" : "MEMBER")
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button
                  className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={handleInvite}
                  disabled={loading}
                >
                  {loading ? "Inviting..." : "Invite Member"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Analytics</h2>
                  <p className="text-sm text-slate-500">Last {days} days</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    value={days}
                    onChange={(event) => setDays(Number(event.target.value))}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                    onClick={() => setRefreshTick((value) => value + 1)}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Error Frequency
                  </p>
                  <svg className="mt-4 h-16 w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d={linePath(frequency, maxFrequency)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    <span>{frequency[0]?.date.slice(5) || ""}</span>
                    <span>{frequency[frequency.length - 1]?.date.slice(5) || ""}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Errors Last Seen
                  </p>
                  <svg className="mt-4 h-16 w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d={linePath(lastSeen, maxLastSeen)}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    <span>{lastSeen[0]?.date.slice(5) || ""}</span>
                    <span>{lastSeen[lastSeen.length - 1]?.date.slice(5) || ""}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-ink">Recent Errors</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    placeholder="Search errors"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
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
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
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

              {loading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}
              {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

              <div className="mt-6 space-y-4">
                {errors.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/errors/${item.id}`}
                    className="block rounded-xl border border-slate-100 px-4 py-4 transition hover:border-amber-200 hover:bg-amber-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.message}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Last seen {new Date(item.lastSeen).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {item.count} hits
                      </span>
                    </div>
                    {item.analysis?.aiExplanation && (
                      <p className="mt-3 text-sm text-slate-600">
                        AI: {item.analysis.aiExplanation}
                      </p>
                    )}
                  </Link>
                ))}
                {!loading && !errors.length && (
                  <p className="text-sm text-slate-500">No errors yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
