"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Toast = {
  message: string;
  tone: "success" | "error";
};

type AdminOverview = {
  stats: {
    totalUsers: number;
    totalOrganizations: number;
    totalProjects: number;
    totalErrors: number;
    activePersonalPlans: number;
    activeTeamPlans: number;
    suspendedUsers: number;
  };
  integrations: Array<{
    provider: string;
    count: number;
  }>;
  recentUsers: Array<{
    id: string;
    fullName: string | null;
    email: string;
    plan: "FREE" | "DEV" | "PRO" | "TEAM";
    createdAt: string;
    planExpiresAt: string | null;
    disabledAt?: string | null;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    plan: "FREE" | "DEV" | "PRO" | "TEAM";
    interval: "MONTHLY" | "YEARLY" | null;
    createdAt: string;
    user: {
      email: string;
      fullName: string | null;
    } | null;
    organization: {
      name: string;
    } | null;
  }>;
};

type AdminUser = {
  id: string;
  fullName: string | null;
  email: string;
  plan: "FREE" | "DEV" | "PRO" | "TEAM";
  planInterval: "MONTHLY" | "YEARLY" | null;
  planExpiresAt: string | null;
  disabledAt?: string | null;
  disabledReason?: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count: {
    projects: number;
    memberships: number;
    payments: number;
  };
};

type UserDetailResponse = {
  user: {
    id: string;
    fullName: string | null;
    email: string;
    plan: "FREE" | "DEV" | "PRO" | "TEAM";
    planInterval: "MONTHLY" | "YEARLY" | null;
    proPricingTier: "LAUNCH" | "STANDARD" | null;
    planExpiresAt: string | null;
    subscriptionStatus: string | null;
    emailVerifiedAt: string | null;
    createdAt: string;
    disabledAt: string | null;
    disabledReason: string | null;
    projects: Array<{
      id: string;
      name: string;
      orgId: string | null;
      createdAt: string;
    }>;
    memberships: Array<{
      role: "OWNER" | "MEMBER";
      createdAt: string;
      organization: {
        id: string;
        name: string;
        plan: "FREE" | "DEV" | "PRO" | "TEAM";
      };
    }>;
    payments: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      plan: "FREE" | "DEV" | "PRO" | "TEAM";
      interval: "MONTHLY" | "YEARLY" | null;
      createdAt: string;
      organization: {
        id: string;
        name: string;
      } | null;
    }>;
    _count: {
      projects: number;
      memberships: number;
      payments: number;
    };
  };
};

type UsersResponse = {
  users: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type SubscribersResponse = {
  summary: {
    totalSubscribers: number;
    matchingSubscribers: number;
  };
  subscribers: Array<{
    id: string;
    email: string;
    sourcePath: string | null;
    status: string;
    subscribedAt: string;
    updatedAt: string;
  }>;
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10 / page" },
  { value: 20, label: "20 / page" },
  { value: 30, label: "30 / page" }
];

const DURATION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "365 days" }
];

const planTagClassName = (plan: AdminUser["plan"]) => {
  if (plan === "PRO") return "tf-success-tag";
  if (plan === "DEV") return "tf-warning-tag";
  if (plan === "TEAM") return "tf-success-tag";
  return "tf-muted-tag";
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0
  }).format(amount / 100);

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export default function AdminDashboardPage() {
  const { token, user, isReady } = useAuth();
  const [toast, setToast] = useState<Toast | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [usersResponse, setUsersResponse] = useState<UsersResponse | null>(null);
  const [subscribersResponse, setSubscribersResponse] = useState<SubscribersResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [subscribersLoading, setSubscribersLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [reason, setReason] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [subscriberSearchInput, setSubscriberSearchInput] = useState("");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pendingPlans, setPendingPlans] = useState<Record<string, "FREE" | "DEV" | "PRO">>({});
  const [pendingDurations, setPendingDurations] = useState<Record<string, number>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [sendingTestAnnouncement, setSendingTestAnnouncement] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [suspensionTarget, setSuspensionTarget] = useState<AdminUser | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const loadOverview = async () => {
    if (!token || !isSuperAdmin) return;
    setOverviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as AdminOverview & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load admin overview");
      }
      setOverview(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load admin overview", "error");
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!token || !isSuperAdmin) return;
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as UsersResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load admin users");
      }
      setUsersResponse(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load admin users", "error");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadSubscribers = async () => {
    if (!token || !isSuperAdmin) return;
    setSubscribersLoading(true);
    try {
      const params = new URLSearchParams({ take: "25" });
      if (subscriberSearch.trim()) {
        params.set("search", subscriberSearch.trim());
      }
      const res = await fetch(`${API_URL}/admin/subscribers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as SubscribersResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load subscribers");
      }
      setSubscribersResponse(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load subscribers", "error");
    } finally {
      setSubscribersLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !token || !isSuperAdmin) {
      setOverviewLoading(false);
      setUsersLoading(false);
      return;
    }
    void loadOverview();
  }, [isReady, token, isSuperAdmin]);

  useEffect(() => {
    if (!isReady || !token || !isSuperAdmin) {
      setUsersLoading(false);
      return;
    }
    void loadUsers();
  }, [isReady, token, isSuperAdmin, page, pageSize, search]);

  useEffect(() => {
    if (!isReady || !token || !isSuperAdmin) {
      setSubscribersLoading(false);
      return;
    }
    void loadSubscribers();
  }, [isReady, token, isSuperAdmin, subscriberSearch]);

  useEffect(() => {
    if (!usersResponse?.users?.length) return;
    setPendingPlans((current) => {
      const next = { ...current };
      let changed = false;
      for (const entry of usersResponse.users) {
        if (!next[entry.id] || !["FREE", "DEV", "PRO"].includes(next[entry.id])) {
          next[entry.id] = entry.plan === "TEAM" ? "FREE" : entry.plan;
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setPendingDurations((current) => {
      const next = { ...current };
      let changed = false;
      for (const entry of usersResponse.users) {
        if (!next[entry.id]) {
          next[entry.id] = 30;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [usersResponse]);

  const totals = useMemo(
    () => overview?.stats ?? null,
    [overview]
  );

  const submitAccessRequest = async () => {
    if (!token) {
      showToast("Please sign in again to request access.", "error");
      return;
    }

    setRequestingAccess(true);
    try {
      const res = await fetch(`${API_URL}/admin/request-access`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason })
      });
      const data = (await res.json()) as { ok?: boolean; alreadyApproved?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to send the access request");
      }
      showToast(
        data.alreadyApproved
          ? "This account is already approved for super admin access."
          : "Your request was sent to team@usetraceforge.com.",
        "success"
      );
      if (!data.alreadyApproved) {
        setReason("");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to send the access request", "error");
    } finally {
      setRequestingAccess(false);
    }
  };

  const submitAnnouncement = async (mode: "test" | "send") => {
    if (!token) {
      showToast("Please sign in again to send announcements.", "error");
      return;
    }

    const subject = announcementSubject.trim();
    const message = announcementMessage.trim();

    if (subject.length < 4) {
      showToast("Add a clearer subject before sending.", "error");
      return;
    }

    if (message.length < 20) {
      showToast("Write a little more detail in the announcement.", "error");
      return;
    }

    if (mode === "test") {
      setSendingTestAnnouncement(true);
    } else {
      setSendingAnnouncement(true);
    }

    try {
      const res = await fetch(
        `${API_URL}/admin/announcements/${mode === "test" ? "test" : "send"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ subject, message })
        }
      );
      const data = (await res.json()) as {
        error?: string;
        sentTo?: string;
        sentCount?: number;
        totalSubscribers?: number;
        failedCount?: number;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to send announcement");
      }

      if (mode === "test") {
        showToast(`Test email sent to ${data.sentTo || "the super admin inbox"}.`, "success");
      } else {
        showToast(
          `Announcement sent to ${data.sentCount || 0} of ${data.totalSubscribers || 0} subscribers.`,
          data.failedCount ? "error" : "success"
        );
      }

      await loadSubscribers();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to send announcement", "error");
    } finally {
      if (mode === "test") {
        setSendingTestAnnouncement(false);
      } else {
        setSendingAnnouncement(false);
      }
    }
  };

  const applyPlanChange = async (targetUser: AdminUser) => {
    if (!token) {
      showToast("Please sign in again to manage users.", "error");
      return;
    }

    const plan = pendingPlans[targetUser.id] || (targetUser.plan === "TEAM" ? "FREE" : targetUser.plan);
    const durationDays = pendingDurations[targetUser.id] || 30;

    setSavingUserId(targetUser.id);
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUser.id}/plan`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan, durationDays })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update the user plan");
      }
      showToast(`Updated ${targetUser.email} to ${plan}.`, "success");
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update the user plan", "error");
    } finally {
      setSavingUserId(null);
    }
  };

  const openUserDetail = async (targetUser: AdminUser) => {
    if (!token) {
      showToast("Please sign in again to view user details.", "error");
      return;
    }

    setDetailTarget(targetUser);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as UserDetailResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load user details");
      }
      setDetail(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load user details", "error");
      setDetailTarget(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeUserDetail = () => {
    setDetailTarget(null);
    setDetail(null);
    setDetailLoading(false);
  };

  const submitSuspensionChange = async (targetUser: AdminUser, action: "suspend" | "reactivate") => {
    if (!token) {
      showToast("Please sign in again to manage user access.", "error");
      return;
    }

    setStatusUpdatingUserId(targetUser.id);
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUser.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          reason: suspensionReason
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} the user`);
      }
      showToast(
        action === "suspend"
          ? `Suspended ${targetUser.email}.`
          : `Reactivated ${targetUser.email}.`,
        "success"
      );
      setSuspensionTarget(null);
      setSuspensionReason("");
      await Promise.all([loadUsers(), loadOverview()]);
      if (detailTarget?.id === targetUser.id) {
        await openUserDetail(targetUser);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Failed to ${action} the user`, "error");
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  const deleteUser = async (targetUser: AdminUser) => {
    if (!token) {
      showToast("Please sign in again to delete this user.", "error");
      return;
    }

    setDeletingUserId(targetUser.id);
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = (await res.json()) as { error?: string; blockers?: { organizations?: string[] } };
      if (!res.ok) {
        const blockers =
          data.blockers?.organizations?.length
            ? ` Blockers: ${data.blockers.organizations.join(", ")}`
            : "";
        throw new Error((data.error || "Failed to delete this user") + blockers);
      }
      showToast(`Deleted ${targetUser.email}.`, "success");
      setDeleteTarget(null);
      setDeleteConfirmationInput("");
      closeUserDetail();
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete this user", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!isReady) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded-3xl bg-secondary/70" />
        <div className="h-56 animate-pulse rounded-3xl bg-secondary/70" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <>
        <section className="rounded-[32px] border border-border bg-card/95 p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
            Super Admin
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            Request super admin access
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
            This page is reserved for platform operators. If you need access, we can send your
            request to <span className="font-semibold text-text-primary">team@usetraceforge.com</span>{" "}
            with a short reason.
          </p>

          <div className="mt-6 rounded-3xl border border-border bg-background/70 p-5">
            <label className="text-sm font-semibold text-text-primary" htmlFor="admin-access-reason">
              Why do you need access?
            </label>
            <textarea
              id="admin-access-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={5}
              className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              placeholder="Add a short reason so we know what you need help with."
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="tf-button inline-flex px-4 py-2 text-sm"
                onClick={() => void submitAccessRequest()}
                disabled={requestingAccess}
              >
                <LoadingButtonContent
                  loading={requestingAccess}
                  loadingLabel="Sending request..."
                  idleLabel="Send request"
                />
              </button>
              <p className="text-xs text-text-secondary">
                We’ll send the request from <span className="font-semibold text-text-primary">{user?.email}</span>.
              </p>
            </div>
          </div>
        </section>

        {toast ? (
          <div
            className={`fixed right-4 top-4 z-[70] rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
              toast.tone === "success" ? "tf-success-toast" : "tf-error-toast"
            }`}
          >
            {toast.message}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="rounded-[32px] border border-border bg-card/95 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Super Admin
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Platform overview and user controls
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
              Keep an eye on core platform stats, billing activity, connected integrations, and
              user plans from one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[24rem]">
            {[
              { label: "API live", href: `${API_URL}/health/live` },
              { label: "API ready", href: `${API_URL}/health/ready` },
              { label: "Diagnostics", href: `${API_URL}/health/diagnostics` }
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-text-secondary transition hover:border-primary/20 hover:text-text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Users", value: totals?.totalUsers, note: "Signed up accounts" },
            { label: "Organizations", value: totals?.totalOrganizations, note: "Tracked workspaces" },
            { label: "Projects", value: totals?.totalProjects, note: "Active projects" },
            { label: "Open errors", value: totals?.totalErrors, note: "Current error groups" },
            { label: "Paid personal plans", value: totals?.activePersonalPlans, note: "Dev + Pro accounts" },
          { label: "Active team plans", value: totals?.activeTeamPlans, note: "Organization subscriptions" },
          { label: "Suspended users", value: totals?.suspendedUsers, note: "Currently blocked from access" }
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-text-secondary">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
              {overviewLoading ? "—" : item.value?.toLocaleString("en-IN") ?? "0"}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <article className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Recent users</h2>
              <p className="mt-1 text-sm text-text-secondary">Newest accounts and their current plan state.</p>
            </div>
            <span className="tf-muted-tag">Latest 6</span>
          </div>
          <div className="mt-5 space-y-3">
            {(overview?.recentUsers || []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-border bg-background/70 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-text-primary">
                    {entry.fullName?.trim() || entry.email.split("@")[0]}
                  </p>
                  <span className={planTagClassName(entry.plan)}>{entry.plan}</span>
                  {entry.disabledAt ? <span className="tf-danger-tag">Suspended</span> : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{entry.email}</p>
                <p className="mt-2 text-xs text-text-secondary">
                  Joined {formatDateTime(entry.createdAt)}
                  {entry.planExpiresAt ? ` • Expires ${formatDateTime(entry.planExpiresAt)}` : ""}
                </p>
              </div>
            ))}
            {!overviewLoading && !overview?.recentUsers?.length ? (
              <p className="rounded-2xl border border-dashed border-border bg-background/50 px-4 py-5 text-sm text-text-secondary">
                No recent users yet.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Connected integrations</h2>
              <p className="mt-1 text-sm text-text-secondary">How many active platform connections exist right now.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {(overview?.integrations || []).map((integration) => (
              <div
                key={integration.provider}
                className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold capitalize text-text-primary">
                    {integration.provider.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">Connected accounts</p>
                </div>
                <span className="text-2xl font-semibold text-text-primary">
                  {integration.count.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {!overviewLoading && !overview?.integrations?.length ? (
              <p className="rounded-2xl border border-dashed border-border bg-background/50 px-4 py-5 text-sm text-text-secondary">
                No integrations connected yet.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Recent payments</h2>
            <p className="mt-1 text-sm text-text-secondary">Latest billing activity across personal and team accounts.</p>
          </div>
          <span className="tf-muted-tag">Latest 8</span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-text-secondary">
              <tr>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-3 py-3 font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recentPayments || []).map((payment) => (
                <tr key={payment.id} className="border-t border-border/70">
                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold text-text-primary">
                      {payment.organization?.name || payment.user?.fullName || payment.user?.email || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {payment.organization
                        ? `Organization payment`
                        : payment.user?.email || "No billing email"}
                    </p>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className={planTagClassName(payment.plan)}>{payment.plan}</span>
                    {payment.interval ? (
                      <p className="mt-2 text-xs text-text-secondary">{payment.interval.toLowerCase()}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-4 align-top text-text-primary">
                    {formatMoney(payment.amount, payment.currency)}
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className="tf-muted-tag">{payment.status}</span>
                  </td>
                  <td className="px-3 py-4 align-top text-text-secondary">
                    {formatDateTime(payment.createdAt)}
                  </td>
                </tr>
              ))}
              {!overviewLoading && !overview?.recentPayments?.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-text-secondary">
                    No payment records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Announcements</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Send product updates or launch offers to everyone subscribed from the footer and signup flows.
              </p>
            </div>
            <span className="tf-muted-tag">
              {subscribersLoading
                ? "Loading subscribers..."
                : `${subscribersResponse?.summary.totalSubscribers?.toLocaleString("en-IN") || 0} subscribed`}
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-sm font-semibold text-text-primary" htmlFor="announcement-subject">
                Subject
              </label>
              <input
                id="announcement-subject"
                value={announcementSubject}
                onChange={(event) => setAnnouncementSubject(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="What are we announcing?"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-text-primary" htmlFor="announcement-message">
                Message
              </label>
              <textarea
                id="announcement-message"
                value={announcementMessage}
                onChange={(event) => setAnnouncementMessage(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="Share the update, offer, or launch note you want subscribers to receive."
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-text-secondary">
                Start with a test email to <span className="font-semibold text-text-primary">team@usetraceforge.com</span>, then send the final version to subscribers.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-primary/20 hover:text-text-primary"
                  onClick={() => void submitAnnouncement("test")}
                  disabled={sendingTestAnnouncement || sendingAnnouncement}
                >
                  <LoadingButtonContent
                    loading={sendingTestAnnouncement}
                    loadingLabel="Sending test..."
                    idleLabel="Send test"
                  />
                </button>
                <button
                  type="button"
                  className="tf-button inline-flex px-4 py-2.5 text-sm"
                  onClick={() => void submitAnnouncement("send")}
                  disabled={sendingAnnouncement || sendingTestAnnouncement}
                >
                  <LoadingButtonContent
                    loading={sendingAnnouncement}
                    loadingLabel="Sending..."
                    idleLabel="Send to subscribers"
                  />
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Subscribers</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Recent subscribed emails from footer signups and account registration flows.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  Total subscribed
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {subscribersLoading
                    ? "—"
                    : subscribersResponse?.summary.totalSubscribers?.toLocaleString("en-IN") || "0"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  Showing now
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {subscribersLoading
                    ? "—"
                    : subscribersResponse?.summary.matchingSubscribers?.toLocaleString("en-IN") || "0"}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                value={subscriberSearchInput}
                onChange={(event) => setSubscriberSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSubscriberSearch(subscriberSearchInput.trim());
                  }
                }}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="Search by email or source"
              />
              <button
                type="button"
                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-primary/20 hover:text-text-primary"
                onClick={() => setSubscriberSearch(subscriberSearchInput.trim())}
              >
                Search
              </button>
            </div>

            <div className="space-y-3">
              {(subscribersResponse?.subscribers || []).map((subscriber) => (
                <div key={subscriber.id} className="rounded-2xl border border-border bg-background/70 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text-primary">{subscriber.email}</p>
                    <span className="tf-success-tag">{subscriber.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    Source {subscriber.sourcePath || "unknown"} • subscribed {formatDateTime(subscriber.subscribedAt)}
                  </p>
                </div>
              ))}
              {!subscribersLoading && !subscribersResponse?.subscribers?.length ? (
                <p className="rounded-2xl border border-dashed border-border bg-background/50 px-4 py-5 text-sm text-text-secondary">
                  No subscribers match this search yet.
                </p>
              ) : null}
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">User management</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Search platform users, review usage footprint, and grant Free, Dev, or Pro access.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10 sm:w-72"
              placeholder="Search by name or email"
            />
            <button
              type="button"
              className="tf-button inline-flex px-4 py-2 text-sm"
              onClick={() => {
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              Search
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-text-secondary">
              <tr>
                <th className="px-3 py-3 font-semibold">User</th>
                <th className="px-3 py-3 font-semibold">Current plan</th>
                <th className="px-3 py-3 font-semibold">Footprint</th>
                <th className="px-3 py-3 font-semibold">Grant access</th>
                <th className="px-3 py-3 font-semibold">Account controls</th>
              </tr>
            </thead>
            <tbody>
              {(usersResponse?.users || []).map((entry) => {
                const selectedPlan = pendingPlans[entry.id] || (entry.plan === "TEAM" ? "FREE" : entry.plan);
                const selectedDuration = pendingDurations[entry.id] || 30;
                const isSaving = savingUserId === entry.id;
                const isStatusUpdating = statusUpdatingUserId === entry.id;
                const isDeleting = deletingUserId === entry.id;
                const isCurrentUser = entry.id === user?.id;
                const isSuspended = Boolean(entry.disabledAt);
                return (
                  <tr key={entry.id} className="border-t border-border/70">
                    <td className="px-3 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">
                          {entry.fullName?.trim() || entry.email.split("@")[0]}
                        </p>
                        {entry.id === user?.id ? (
                          <span className="tf-muted-tag">Current session</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{entry.email}</p>
                      <p className="mt-2 text-xs text-text-secondary">
                        Joined {formatDateTime(entry.createdAt)}
                        {entry.emailVerifiedAt ? " • verified" : " • not verified"}
                      </p>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <span className={planTagClassName(entry.plan)}>{entry.plan}</span>
                      {entry.disabledAt ? <span className="ml-2 tf-danger-tag">Suspended</span> : null}
                      <p className="mt-2 text-xs text-text-secondary">
                        {entry.planExpiresAt ? `Expires ${formatDateTime(entry.planExpiresAt)}` : "No expiry set"}
                      </p>
                      {entry.disabledReason ? (
                        <p className="mt-2 text-xs text-text-secondary">
                          Reason: {entry.disabledReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 align-top text-text-secondary">
                      <p>{entry._count.projects} projects</p>
                      <p className="mt-1">{entry._count.memberships} org memberships</p>
                      <p className="mt-1">{entry._count.payments} payments</p>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex min-w-[20rem] flex-col gap-3 sm:flex-row sm:items-center">
                        <select
                          value={selectedPlan}
                          onChange={(event) =>
                            setPendingPlans((current) => ({
                              ...current,
                              [entry.id]: event.target.value as "FREE" | "DEV" | "PRO"
                            }))
                          }
                          className="tf-select w-full sm:w-36"
                          disabled={isSaving || entry.plan === "TEAM" || isSuspended}
                        >
                          <option value="FREE">Free</option>
                          <option value="DEV">Dev</option>
                          <option value="PRO">Pro</option>
                        </select>
                        <select
                          value={selectedDuration}
                          onChange={(event) =>
                            setPendingDurations((current) => ({
                              ...current,
                              [entry.id]: Number(event.target.value)
                            }))
                          }
                          className="tf-select w-full sm:w-36"
                          disabled={isSaving || selectedPlan === "FREE" || entry.plan === "TEAM" || isSuspended}
                        >
                          {DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="tf-button inline-flex min-w-[8rem] justify-center px-4 py-2 text-sm"
                          onClick={() => void applyPlanChange(entry)}
                          disabled={isSaving || entry.plan === "TEAM" || isSuspended}
                        >
                          <LoadingButtonContent
                            loading={isSaving}
                            loadingLabel="Applying..."
                            idleLabel="Apply"
                          />
                        </button>
                      </div>
                      {entry.plan === "TEAM" ? (
                        <p className="mt-2 text-xs text-text-secondary">
                          Team billing stays organization-scoped and isn’t changed from here.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex min-w-[17rem] flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-primary/20 hover:text-text-primary"
                          onClick={() => void openUserDetail(entry)}
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-primary/20 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            setSuspensionTarget(entry);
                            setSuspensionReason(entry.disabledReason || "");
                          }}
                          disabled={isStatusUpdating || isCurrentUser}
                        >
                          {isStatusUpdating ? "Updating..." : isSuspended ? "Reactivate" : "Suspend"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                          onClick={() => {
                            setDeleteTarget(entry);
                            setDeleteConfirmationInput("");
                          }}
                          disabled={isDeleting || isCurrentUser}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                      {isCurrentUser ? (
                        <p className="mt-2 text-xs text-text-secondary">
                          Use account settings for your own account actions.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!usersLoading && !usersResponse?.users?.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-text-secondary">
                    No users match this search yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {usersResponse?.pagination ? (
          <DashboardPagination
            page={usersResponse.pagination.page}
            totalPages={usersResponse.pagination.totalPages}
            pageSize={usersResponse.pagination.pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPage(1);
              setPageSize(value);
            }}
            className="mt-5"
          />
        ) : null}
      </section>

      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[70] rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
            toast.tone === "success" ? "tf-success-toast" : "tf-error-toast"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {detailTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-border bg-card p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  User detail
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-text-primary">
                  {detailTarget.fullName?.trim() || detailTarget.email.split("@")[0]}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">{detailTarget.email}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
                onClick={closeUserDetail}
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <div className="mt-6 h-48 animate-pulse rounded-3xl bg-secondary/70" />
            ) : detail ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Plan", value: detail.user.plan },
                    { label: "Created", value: formatDateTime(detail.user.createdAt) },
                    { label: "Verified", value: detail.user.emailVerifiedAt ? "Yes" : "No" },
                    { label: "Status", value: detail.user.disabledAt ? "Suspended" : "Active" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-text-primary">{item.value}</p>
                    </div>
                  ))}
                </div>

                {detail.user.disabledReason ? (
                  <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4 text-sm text-text-secondary">
                    Suspension reason: <span className="font-semibold text-text-primary">{detail.user.disabledReason}</span>
                  </div>
                ) : null}

                <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-3xl border border-border bg-background/70 p-5">
                    <h4 className="text-lg font-semibold text-text-primary">Projects</h4>
                    <div className="mt-4 space-y-3">
                      {detail.user.projects.length ? detail.user.projects.map((project) => (
                        <div key={project.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                          <p className="font-semibold text-text-primary">{project.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {project.orgId ? "Organization project" : "Personal project"} • {formatDateTime(project.createdAt)}
                          </p>
                        </div>
                      )) : (
                        <p className="text-sm text-text-secondary">No active projects.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background/70 p-5">
                    <h4 className="text-lg font-semibold text-text-primary">Organizations</h4>
                    <div className="mt-4 space-y-3">
                      {detail.user.memberships.length ? detail.user.memberships.map((membership) => (
                        <div key={`${membership.organization.id}-${membership.role}`} className="rounded-2xl border border-border bg-card px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-text-primary">{membership.organization.name}</p>
                            <span className="tf-muted-tag">{membership.role}</span>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            Joined {formatDateTime(membership.createdAt)}
                          </p>
                        </div>
                      )) : (
                        <p className="text-sm text-text-secondary">No organization memberships.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-border bg-background/70 p-5">
                  <h4 className="text-lg font-semibold text-text-primary">Recent payments</h4>
                  <div className="mt-4 space-y-3">
                    {detail.user.payments.length ? detail.user.payments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={planTagClassName(payment.plan)}>{payment.plan}</span>
                          <span className="text-sm font-semibold text-text-primary">
                            {formatMoney(payment.amount, payment.currency)}
                          </span>
                          <span className="tf-muted-tag">{payment.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          {payment.organization?.name ? `${payment.organization.name} • ` : ""}
                          {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    )) : (
                      <p className="text-sm text-text-secondary">No payments yet.</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {suspensionTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[32px] border border-border bg-card p-6 shadow-2xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {suspensionTarget.disabledAt ? "Reactivate user" : "Suspend user"}
            </p>
            <h3 className="mt-4 text-2xl font-semibold text-text-primary">
              {suspensionTarget.disabledAt ? "Restore account access" : "Block account access"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              {suspensionTarget.disabledAt
                ? `This will let ${suspensionTarget.email} sign in again immediately.`
                : `This will stop ${suspensionTarget.email} from signing in or using active sessions until reactivated.`}
            </p>

            <label className="mt-5 block text-sm font-semibold text-text-primary" htmlFor="suspension-reason">
              Reason
            </label>
            <textarea
              id="suspension-reason"
              value={suspensionReason}
              onChange={(event) => setSuspensionReason(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              placeholder="Optional note for future admins."
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
                onClick={() => {
                  setSuspensionTarget(null);
                  setSuspensionReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-button inline-flex px-4 py-2 text-sm"
                onClick={() =>
                  void submitSuspensionChange(
                    suspensionTarget,
                    suspensionTarget.disabledAt ? "reactivate" : "suspend"
                  )
                }
                disabled={statusUpdatingUserId === suspensionTarget.id}
              >
                <LoadingButtonContent
                  loading={statusUpdatingUserId === suspensionTarget.id}
                  loadingLabel={suspensionTarget.disabledAt ? "Reactivating..." : "Suspending..."}
                  idleLabel={suspensionTarget.disabledAt ? "Reactivate user" : "Suspend user"}
                />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[32px] border border-border bg-card p-6 shadow-2xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Delete user
            </p>
            <h3 className="mt-4 text-2xl font-semibold text-text-primary">
              Permanently delete {deleteTarget.fullName?.trim() || deleteTarget.email}
            </h3>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              This removes the account and personal data we can safely delete. If the user is the
              only member in an organization, deletion will be blocked until that organization has
              another member.
            </p>

            <label className="mt-5 block text-sm font-semibold text-text-primary" htmlFor="delete-user-confirmation">
              Type the user email to confirm
            </label>
            <input
              id="delete-user-confirmation"
              value={deleteConfirmationInput}
              onChange={(event) => setDeleteConfirmationInput(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              placeholder={deleteTarget.email}
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmationInput("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  deletingUserId === deleteTarget.id ||
                  deleteConfirmationInput.trim().toLowerCase() !== deleteTarget.email.toLowerCase()
                }
                onClick={() => void deleteUser(deleteTarget)}
              >
                <LoadingButtonContent
                  loading={deletingUserId === deleteTarget.id}
                  loadingLabel="Deleting..."
                  idleLabel="Delete user"
                />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
