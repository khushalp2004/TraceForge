"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";
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

type Toast = {
  message: string;
  tone: "success" | "error";
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
  const [toast, setToast] = useState<Toast | null>(null);
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

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

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

      showToast(`Invite sent to ${inviteEmail.trim()}`, "success");
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
        showToast("Request sent for approval", "success");
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
      showToast("Invite link copied", "success");
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
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Link
        href="/dashboard/orgs"
        className="group mb-8 inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Organizations
      </Link>
      
      <header className="mb-10 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {org?.name || "Organization"}
          </h1>
          <PageDescriptionPopover>
            Manage members, invites, and audit history.
          </PageDescriptionPopover>
        </div>
        {hasAccess && (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-5 py-2.5 text-[13px] font-semibold text-text-primary shadow-sm backdrop-blur-md transition-all hover:bg-secondary/60 hover:shadow"
            onClick={() => setShowInviteModal(true)}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Generate Link
          </button>
        )}
      </header>

      {!hasAccess && (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-border/40 bg-secondary/10 px-6 py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-text-primary">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">Access Required</h2>
          <p className="mt-2 max-w-sm text-[15px] text-text-secondary">
            You aren't a member of this organization yet. Enter an invite token below to join.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 rounded-2xl border border-border/50 bg-card px-4 py-3.5 text-[15px] text-text-primary shadow-sm outline-none transition-all placeholder:text-text-secondary/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              placeholder="Paste invite token..."
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <button
              className="inline-flex h-[52px] items-center justify-center rounded-2xl bg-primary px-6 font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
              onClick={() => handleAcceptInvite()}
              disabled={loading || !tokenInput.trim()}
            >
              <LoadingButtonContent
                loading={loading}
                loadingLabel="Joining..."
                idleLabel="Join"
              />
            </button>
          </div>
        </div>
      )}

        {hasAccess && (
          <div className="space-y-8">
            {loading && <p className="text-[13px] text-text-secondary animate-pulse">Syncing...</p>}

            {/* Members Section */}
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Members
              </h2>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-sm">
                
                {/* Inline Invite Bar */}
                <div className="flex flex-col gap-3 border-b border-border/40 bg-secondary/15 p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                    </div>
                    <input
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/60"
                      placeholder="Invite someone via email..."
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                    <select
                      className="appearance-none rounded-full border border-border/50 bg-card px-4 py-2 pr-8 text-[13px] font-medium text-text-primary outline-none transition hover:bg-secondary/40 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 10px center",
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
                    <button
                      className="rounded-full bg-text-primary px-4 py-2 text-[13px] font-semibold text-card transition hover:bg-text-secondary disabled:opacity-50"
                      onClick={handleInvite}
                      disabled={loading || !inviteEmail.trim()}
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* Member List */}
                <div className="flex flex-col">
                  {paginatedMembers.map((member) => {
                    const isSelf = user?.id === member.userId;
                    return (
                      <div
                        key={member.id}
                        className="group flex flex-col gap-4 border-b border-border/40 p-4 transition-colors hover:bg-secondary/10 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-[15px] font-medium text-text-primary">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[15px] font-medium text-text-primary">
                                {member.email}
                              </p>
                              {isSelf && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-text-secondary">
                              Joined {new Date(member.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3 pl-[58px] sm:pl-0">
                          <select
                            className="appearance-none rounded-full border border-border/40 bg-transparent px-3 py-1.5 pr-7 text-[13px] font-medium text-text-secondary outline-none transition hover:bg-secondary/40 hover:text-text-primary focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                            style={{
                              backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 8px center",
                              backgroundSize: "10px 10px"
                            }}
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
                          
                          <button
                            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-text-secondary transition hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                            onClick={() => handleRemove(member.id, isSelf)}
                            disabled={loading}
                          >
                            {isSelf ? "Leave" : "Remove"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!members.length && !loading && (
                    <div className="p-6 text-center text-[15px] text-text-secondary">
                      No members yet.
                    </div>
                  )}
                </div>

                {members.length > 5 && (
                  <div className="border-t border-border/40 px-4 py-3 sm:px-6">
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
                  </div>
                )}
              </div>
            </section>

            {/* Audit Log Section */}
            <section>
              <h2 className="mb-4 mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
                Audit Log
              </h2>
              <div className="overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-sm">
                <div className="flex flex-col">
                  {paginatedLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between border-b border-border/40 p-4 last:border-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/50 text-text-secondary">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-text-primary">{log.action}</p>
                          <p className="truncate text-[12px] text-text-secondary">{log.actorEmail}</p>
                        </div>
                      </div>
                      <span className="shrink-0 pl-3 text-[12px] text-text-secondary">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {!logs.length && (
                    <div className="p-6 text-center text-[15px] text-text-secondary">
                      No activity recorded yet.
                    </div>
                  )}
                </div>
                {logs.length > 5 && (
                  <div className="border-t border-border/40 px-4 py-3 sm:px-6">
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
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 px-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-8rem)] sm:max-h-[90vh] rounded-[32px] border border-border/50 bg-card/95 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0">
              <h3 className="text-[15px] font-semibold text-text-primary">Generate Invite Link</h3>
              <button onClick={() => setShowInviteModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               <p className="text-[14px] text-text-secondary mb-6">
                 Create a shareable link for this organization. Anyone opening it will request access based on the role you choose.
               </p>

               <div className="mb-6 rounded-[20px] border border-border/40 bg-secondary/10 p-4">
                 <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                   Access Level
                 </p>
                 <div className="grid gap-3 sm:grid-cols-2">
                   <button
                     className={`flex flex-col items-start rounded-[16px] border px-4 py-3.5 transition-all ${
                       inviteRole === "MEMBER"
                         ? "border-primary bg-primary/10 shadow-sm"
                         : "border-border/40 bg-card hover:border-border/80 hover:bg-secondary/30"
                     }`}
                     onClick={() => setInviteRole("MEMBER")}
                     type="button"
                   >
                     <p className="text-[14px] font-semibold text-text-primary">Member</p>
                     <p className="mt-1 text-[12px] text-text-secondary text-left">
                       Can join the team and collaborate.
                     </p>
                   </button>
                   <button
                     className={`flex flex-col items-start rounded-[16px] border px-4 py-3.5 transition-all ${
                       inviteRole === "OWNER"
                         ? "border-primary bg-primary/10 shadow-sm"
                         : "border-border/40 bg-card hover:border-border/80 hover:bg-secondary/30"
                     }`}
                     onClick={() => setInviteRole("OWNER")}
                     type="button"
                   >
                     <p className="text-[14px] font-semibold text-text-primary">Owner</p>
                     <p className="mt-1 text-[12px] text-text-secondary text-left">
                       Can manage members and invites.
                     </p>
                   </button>
                 </div>
               </div>

               <button
                 className="mb-6 flex w-full items-center justify-center rounded-[16px] bg-primary px-4 py-3.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
                 onClick={handleGenerateInviteLink}
                 disabled={loading}
               >
                 <LoadingButtonContent
                   loading={loading}
                   loadingLabel="Generating..."
                   idleLabel="Generate Link"
                 />
               </button>

               {inviteLink ? (
                 <div className="rounded-[20px] border border-primary/20 bg-primary/5 p-4">
                   <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                     <div className="min-w-0">
                       <p className="text-[14px] font-semibold text-text-primary">Link Ready</p>
                       <p className="text-[12px] text-text-secondary">
                         Share this with your teammate.
                       </p>
                     </div>
                     <button
                       className="inline-flex w-full items-center justify-center rounded-full border border-primary/20 bg-card px-4 py-2 text-[13px] font-semibold text-primary shadow-sm transition hover:bg-primary/10 sm:w-auto"
                       onClick={copyLink}
                     >
                       Copy Link
                     </button>
                   </div>
                   <div className="mt-4 rounded-[12px] border border-border/40 bg-card px-3 py-2.5 text-[12px] text-text-secondary">
                     <span className="block break-all font-mono">{inviteLink}</span>
                   </div>
                 </div>
                 ) : (
                 <div className="flex items-center justify-center rounded-[20px] border border-dashed border-border/60 bg-secondary/5 px-4 py-8 text-center text-[13px] text-text-secondary">
                   Your generated invite link will appear here.
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`tf-dashboard-toast text-xs ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}
    </main>
  );
}
