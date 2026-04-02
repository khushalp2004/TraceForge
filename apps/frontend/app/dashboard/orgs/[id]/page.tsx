"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";
import { DashboardPagination } from "../../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const MEMBER_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];
const AUDIT_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type OrgMember = {
  id: string;
  userId: string;
  email: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type AuditLog = {
  id: string;
  action: string;
  actorEmail: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export default function OrganizationDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <OrganizationDetailPageInner params={params} />
    </Suspense>
  );
}

function OrganizationDetailPageInner({ params }: { params: { id: string } }) {
  const orgId = params.id;
  const { user } = useAuth();
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [inviteLink, setInviteLink] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(5);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(5);
  const searchParams = useSearchParams();

  const membersTotalPages = Math.max(1, Math.ceil(members.length / membersPageSize));
  const auditTotalPages = Math.max(1, Math.ceil(logs.length / auditPageSize));
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * membersPageSize;
    return members.slice(start, start + membersPageSize);
  }, [members, membersPage, membersPageSize]);
  const paginatedLogs = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return logs.slice(start, start + auditPageSize);
  }, [logs, auditPage, auditPageSize]);

  const loadOrg = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    const res = await fetch(`${API_URL}/orgs`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (res.ok) {
      const match = (data.orgs || []).find((item: Org) => item.id === orgId) || null;
      setOrg(match);
      setHasAccess(!!match);
    }
  };

  const loadMembers = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load members");
      }

      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/audit`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load audit log");
      }

      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  useEffect(() => {
    loadOrg();
  }, [orgId]);

  useEffect(() => {
    if (hasAccess) {
      loadMembers();
      loadAudit();
    }
  }, [hasAccess]);

  useEffect(() => {
    setMembersPage((current) => Math.min(current, membersTotalPages));
  }, [membersTotalPages]);

  useEffect(() => {
    setAuditPage((current) => Math.min(current, auditTotalPages));
  }, [auditTotalPages]);

  const handleInvite = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (!inviteEmail.trim()) {
      setError("Invite email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/invites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      setToast(`Invite sent to ${inviteEmail.trim()}`);
      window.setTimeout(() => setToast(null), 2000);
      setInviteEmail("");
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/invites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite link");
      }

      const link = `${window.location.origin}/dashboard?inviteToken=${data.invite.token}`;
      setInviteLink(link);
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (explicitToken?: string) => {
    const token = localStorage.getItem(tokenKey);
    const value = (explicitToken ?? tokenInput).trim();
    if (!token || !value) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/invites/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: value })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      if (data.status === "pending") {
        setToast("Request sent for approval");
        window.setTimeout(() => setToast(null), 2000);
        return;
      }

      setTokenInput("");
      await loadOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: "OWNER" | "MEMBER") => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? { ...member, role } : member))
      );
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string, isSelf: boolean) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      if (isSelf) {
        router.push("/dashboard");
        return;
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberId));
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setToast("Invite link copied");
      window.setTimeout(() => setToast(null), 1800);
    } catch {
      setError("Failed to copy invite link");
    }
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setTokenInput(tokenFromUrl);
      void handleAcceptInvite(tokenFromUrl);
    }
  }, [searchParams]);

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Organization</p>
            <h1 className="font-display mt-2 text-2xl font-semibold text-text-primary">
              {org?.name || "Organization"}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Manage members, invites, and audit history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
              onClick={() => setShowInviteModal(true)}
            >
              Generate link
            </button>
            <Link
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-primary/30 hover:text-text-primary hover:bg-secondary/60"
              href="/dashboard/orgs"
            >
              Back to organizations
            </Link>
          </div>
        </header>

        <div className="tf-divider my-6" />

        {!hasAccess && (
          <div className="tf-card p-5">
            <p className="text-sm font-semibold text-text-primary">Access required</p>
            <p className="mt-2 text-sm text-text-secondary">
              You are not a member of this organization yet. Use the invite token to request
              access.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                className="tf-input w-full sm:min-w-[220px]"
                placeholder="Invite token"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <button className="tf-button-ghost" onClick={() => handleAcceptInvite()} disabled={loading}>
                {loading ? "Submitting..." : "Accept invite"}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </div>
        )}

        {hasAccess && (
          <div className="tf-card space-y-4 p-5">
            <div className="rounded-2xl border border-border bg-secondary/35 p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-text-primary">Invite by email</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Send a direct invite and choose the member&apos;s role.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_160px_auto] lg:items-end">
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-text-secondary">
                    Role
                  </label>
                  <select
                    className="w-full appearance-none rounded-full border border-border bg-card px-5 py-3 pr-10 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 16px center",
                      backgroundSize: "12px 12px"
                    }}
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value === "OWNER" ? "OWNER" : "MEMBER")
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Owner</option>
                  </select>
                </div>

                <button
                  className="rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-text-secondary shadow-sm transition hover:border-primary/30 hover:bg-secondary/60 hover:text-text-primary md:self-end"
                  onClick={handleInvite}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send invite"}
                </button>
              </div>
            </div>
          </div>
        )}

        {hasAccess && (
          <>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            {loading && <p className="mt-2 text-sm text-text-secondary">Working...</p>}

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="tf-section-title">Members</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Manage roles and membership for this organization.
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card/90">
                <div className="hidden grid-cols-[minmax(0,1.5fr)_140px_160px] gap-4 border-b border-border bg-secondary/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary lg:grid">
                  <span>Member</span>
                  <span>Role</span>
                  <span>Action</span>
                </div>

                {paginatedMembers.map((member) => {
                  const isSelf = user?.id === member.userId;
                  return (
                    <div
                      key={member.id}
                      className="grid gap-4 border-b border-border px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.5fr)_140px_160px] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {member.email}
                          </p>
                          {isSelf && (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                              You
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          Joined {new Date(member.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary lg:hidden">
                          Role
                        </p>
                        <select
                          className="tf-select w-full rounded-full px-3 py-2 text-xs"
                          value={member.role}
                          onChange={(event) =>
                            handleRoleChange(
                              member.id,
                              event.target.value === "OWNER" ? "OWNER" : "MEMBER"
                            )
                          }
                          disabled={loading}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary lg:hidden">
                          Action
                        </p>
                        <button
                          className="tf-danger-button w-full rounded-full border px-3 py-2 text-xs font-semibold transition"
                          onClick={() => handleRemove(member.id, isSelf)}
                          disabled={loading}
                        >
                          {isSelf ? "Leave organization" : "Remove member"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!members.length && !loading && (
                  <div className="px-5 py-6 text-sm text-text-secondary">No members yet.</div>
                )}
              </div>

              {members.length > 5 && (
                <DashboardPagination
                  page={membersPage}
                  totalPages={membersTotalPages}
                  pageSize={membersPageSize}
                  pageSizeOptions={MEMBER_PAGE_SIZE_OPTIONS}
                  onPageChange={setMembersPage}
                  onPageSizeChange={(nextSize) => {
                    setMembersPage(1);
                    setMembersPageSize(nextSize);
                  }}
                />
              )}
            </div>

            <div className="tf-card mt-6 p-5">
              <h2 className="tf-section-title">Audit Log</h2>
              <div className="mt-4 space-y-2 text-sm text-text-secondary">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{log.action}</span>
                    <span className="text-xs text-text-secondary">
                      {log.actorEmail} · {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {!logs.length && <p className="text-sm text-text-secondary">No audit events yet.</p>}
              </div>
              {logs.length > 5 && (
                <DashboardPagination
                  page={auditPage}
                  totalPages={auditTotalPages}
                  pageSize={auditPageSize}
                  pageSizeOptions={AUDIT_PAGE_SIZE_OPTIONS}
                  onPageChange={setAuditPage}
                  onPageSizeChange={(nextSize) => {
                    setAuditPage(1);
                    setAuditPageSize(nextSize);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl">
            <div className="border-b border-border bg-secondary/40 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Organization Invite
              </p>
              <h3 className="font-display mt-2 text-xl font-semibold text-text-primary">
                Generate Invite Link
              </h3>
              <p className="mt-2 max-w-md text-sm text-text-secondary">
                Create a shareable link for this organization. Anyone opening it will request access
                based on the role you choose.
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-border bg-secondary/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Access Level
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      inviteRole === "MEMBER"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                    onClick={() => setInviteRole("MEMBER")}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-text-primary">Member</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Can join the team and collaborate.
                    </p>
                  </button>
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      inviteRole === "OWNER"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                    onClick={() => setInviteRole("OWNER")}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-text-primary">Owner</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Can manage members, invites, and roles.
                    </p>
                  </button>
                </div>
              </div>

              <button
                className="tf-button w-full px-4 py-3 text-sm"
                onClick={handleGenerateInviteLink}
                disabled={loading}
              >
                {loading ? "Generating link..." : "Generate link"}
              </button>

              {inviteLink ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Invite link ready</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Share this link with the teammate you want to invite.
                      </p>
                    </div>
                    <button className="tf-pill whitespace-nowrap" onClick={copyLink}>
                      Copy Link
                    </button>
                  </div>
                  <div className="mt-3 rounded-xl border border-border bg-card px-3 py-3 text-xs text-text-secondary">
                    <span className="break-all">{inviteLink}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-text-secondary">
                  Your generated invite link will appear here.
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center justify-end border-t border-border px-6 py-4">
              <button
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70"
                onClick={() => setShowInviteModal(false)}
                disabled={loading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="tf-dashboard-toast bg-emerald-600 text-xs">
          {toast}
        </div>
      )}
    </main>
  );
}
