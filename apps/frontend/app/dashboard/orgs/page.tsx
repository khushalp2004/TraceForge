"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

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

export default function OrgMembersPage() {
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [inviteLink, setInviteLink] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");

  const loadOrgs = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    const res = await fetch(`${API_URL}/orgs`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (res.ok) {
      setOrgs(data.orgs || []);
      if (data.orgs?.length && !selectedOrgId) {
        setSelectedOrgId(data.orgs[0].id);
      }
    }
  };

  const loadMembers = async (orgId: string) => {
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

  const loadAudit = async (orgId: string) => {
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
    loadOrgs();
  }, []);

  const handleAcceptInvite = async (explicitToken?: string) => {
    const authToken = localStorage.getItem(tokenKey);
    const value = (explicitToken ?? tokenInput).trim();
    if (!authToken || !value) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/invites/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: value })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      setTokenInput("");
      await loadOrgs();
      if (selectedOrgId) {
        await loadMembers(selectedOrgId);
        await loadAudit(selectedOrgId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setTokenInput(tokenFromUrl);
      // Auto-accept invite when the user visits with a token in the URL.
      void handleAcceptInvite(tokenFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedOrgId) {
      loadMembers(selectedOrgId);
      loadAudit(selectedOrgId);
    }
  }, [selectedOrgId]);

  const handleInvite = async () => {
    if (!selectedOrgId) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (!inviteEmail.trim()) {
      setError("Invite email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrgId}/invites`, {
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

      setInviteEmail("");
      await loadAudit(selectedOrgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!selectedOrgId) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrgId}/invites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        // Generate a generic invite link that any user can use;
        // email-based invites are handled by the separate "Invite" action.
        body: JSON.stringify({ role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite link");
      }

      const link = `${window.location.origin}/dashboard/orgs?token=${data.invite.token}`;
      setInviteLink(link);
      await loadAudit(selectedOrgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: "OWNER" | "MEMBER") => {
    if (!selectedOrgId) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrgId}/members/${memberId}`, {
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
      await loadAudit(selectedOrgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!selectedOrgId) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrgId}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberId));
      await loadAudit(selectedOrgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      setError("Failed to copy invite link");
    }
  };

  return (
    <main className="tf-page">
      <div className="relative mx-auto max-w-4xl">
          <Link className="tf-link" href="/dashboard">
            ← Back to dashboard
          </Link>
          <header className="mt-4">
            <p className="tf-kicker">Organization Members</p>
            <h1 className="font-display mt-2 text-2xl font-semibold text-ink">
              Team Access
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage organization roles and access.
            </p>
          </header>

          <div className="tf-divider my-6" />

          <div className="tf-card space-y-4 p-6">
          <select
            className="tf-select w-full"
            value={selectedOrgId}
            onChange={(event) => setSelectedOrgId(event.target.value)}
          >
            <option value="">Select organization</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.role.toLowerCase()})
              </option>
            ))}
          </select>

          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="tf-input"
              placeholder="Invite email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
            <select
              className="tf-select"
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value === "OWNER" ? "OWNER" : "MEMBER")
              }
            >
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </select>
            <button
              className="tf-button-ghost"
              onClick={handleInvite}
              disabled={loading}
            >
              {loading ? "Inviting..." : "Invite"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <button
              className="tf-button-ghost"
              onClick={handleGenerateInviteLink}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Invite Link"}
            </button>
            <input
              className="tf-input"
              placeholder="Invite token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <button
              className="tf-button-ghost"
              onClick={handleAcceptInvite}
              disabled={loading}
            >
              Accept Invite
            </button>
          </div>

          {inviteLink && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
              <span className="break-all">{inviteLink}</span>
              <button
                className="tf-pill"
                onClick={copyLink}
              >
                Copy Link
              </button>
            </div>
          )}
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          {loading && <p className="mt-2 text-sm text-slate-500">Working...</p>}

          <div className="mt-6 space-y-4">
            {members.map((member) => (
              <div key={member.id} className="tf-card p-6">
                <div className="tf-row">
                  <div>
                    <p className="text-sm font-semibold text-ink">{member.email}</p>
                    <p className="text-xs text-slate-500">
                      Joined {new Date(member.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="tf-select rounded-full px-3 py-1 text-xs"
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
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50"
                      onClick={() => handleRemove(member.id)}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!members.length && selectedOrgId && !loading && (
              <p className="text-sm text-slate-500">No members yet.</p>
            )}
          </div>

          <div className="tf-card mt-6 p-6">
            <h2 className="tf-section-title">Audit Log</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{log.action}</span>
                  <span className="text-xs text-slate-400">
                    {log.actorEmail} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {!logs.length && (
                <p className="text-sm text-slate-500">No audit events yet.</p>
              )}
            </div>
          </div>
      </div>
    </main>
  );
}
