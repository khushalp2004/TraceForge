"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const loadOrgs = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load teams");
      }

      setOrgs(data.orgs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleDeleteOrg = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete team");
      }

      setOrgs((prev) => prev.filter((org) => org.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (!newOrgName.trim()) {
      setError("Team name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newOrgName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create team");
      }

      setOrgs((prev) => [data.org, ...prev]);
      setNewOrgName("");
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Organizations</p>
            <h1 className="font-display mt-2 text-2xl font-semibold text-text-primary">
              Organization Management
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Select an organization to manage members and permissions.
            </p>
          </div>
          <button
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            onClick={() => setShowCreateModal(true)}
          >
            Create organization
          </button>
        </header>

        <div className="tf-divider my-6" />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-text-secondary">Working...</p>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/dashboard/orgs/${org.id}`}
              className="tf-card group flex flex-col gap-3 p-5 transition hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-text-primary">{org.name}</p>
                  <p className="text-xs text-text-secondary">
                    {org.role.toLowerCase()} · Created {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-text-secondary">
                  Manage
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tf-pill">{org.role}</span>
                <span className="tf-pill">Organization</span>
                {org.role === "OWNER" && (
                  <button
                    type="button"
                    className="tf-danger-button rounded-full border px-3 py-1 text-xs font-semibold transition"
                    onClick={(event) => {
                      event.preventDefault();
                      setError(null);
                      setDeleteTarget(org);
                      setDeleteInput("");
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </Link>
          ))}
          {!orgs.length && !loading && (
            <div className="tf-card p-5 text-sm text-text-secondary">
              No organizations yet. Create one from the dashboard to get started.
            </div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">Delete Organization</h3>
            <p className="mt-2 text-sm text-text-secondary">
              This will permanently delete <span className="font-semibold">{deleteTarget.name}</span>.
              Type the organization name to confirm.
            </p>
            <input
              className="tf-input mt-4 w-full"
              placeholder="Organization name"
              value={deleteInput}
              onChange={(event) => setDeleteInput(event.target.value)}
            />
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70"
                onClick={() => setDeleteTarget(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="tf-danger-solid rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                onClick={handleDeleteOrg}
                disabled={loading || deleteInput.trim() !== deleteTarget.name}
              >
                {loading ? "Deleting..." : "Delete Organization"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">Create Organization</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Create a new organization to manage members and projects.
            </p>
            <input
              className="tf-input mt-4 w-full"
              placeholder="Organization name"
              value={newOrgName}
              onChange={(event) => setNewOrgName(event.target.value)}
            />
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70"
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="tf-button px-4 py-2 text-sm font-semibold"
                onClick={handleCreateOrg}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Organization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
