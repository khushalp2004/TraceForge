"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";
import { Trash2, Edit3, PlusCircle, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const orgsPrefsKey = "traceforge_orgs_prefs_v1";

type Org = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

const ORG_PAGE_SIZE_OPTIONS = [
  { value: 6, label: "6 / page" },
  { value: 12, label: "12 / page" },
  { value: 18, label: "18 / page" }
];

export default function OrgsPage() {
  const prefsHydratedRef = useRef(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [renameTarget, setRenameTarget] = useState<Org | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgsPageSize, setOrgsPageSize] = useState(6);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkActionInput, setBulkActionInput] = useState("");

  const orgsTotalPages = Math.max(1, Math.ceil(orgs.length / orgsPageSize));
  const paginatedOrgs = useMemo(() => {
    const start = (orgsPage - 1) * orgsPageSize;
    return orgs.slice(start, start + orgsPageSize);
  }, [orgs, orgsPage, orgsPageSize]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(orgsPrefsKey);
      if (!raw) return;
      const prefs = JSON.parse(raw) as { pageSize?: number };
      if (typeof prefs.pageSize === "number" && prefs.pageSize > 0) {
        setOrgsPageSize(prefs.pageSize);
      }
    } catch {
      // Ignore malformed prefs.
    } finally {
      prefsHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
    window.localStorage.setItem(
      orgsPrefsKey,
      JSON.stringify({
        pageSize: orgsPageSize
      })
    );
  }, [orgsPageSize]);

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

  useEffect(() => {
    setOrgsPage((current) => Math.min(current, orgsTotalPages));
  }, [orgsTotalPages]);

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

  const handleRenameOrg = async () => {
    if (!renameTarget) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (!renameInput.trim()) {
      setError("Organization name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/orgs/${renameTarget.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: renameInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rename organization");
      }

      setOrgs((prev) =>
        prev.map((org) => (org.id === renameTarget.id ? { ...org, name: data.org.name } : org))
      );
      setRenameTarget(null);
      setRenameInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const toggleOrgSelection = (orgId: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const handleBulkDeleteOrgs = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || selectedOrgIds.size === 0) return;

    setLoading(true);
    try {
      const ids = Array.from(selectedOrgIds);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`${API_URL}/orgs/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );

      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        showToast(`Failed to delete ${failedCount} teams`, "error");
      } else {
        showToast(`Deleted ${ids.length} teams`, "success");
        setSelectedOrgIds(new Set());
      }
      await loadOrgs();
    } catch (err) {
      showToast("Bulk deletion failed", "error");
    } finally {
      setLoading(false);
      setShowBulkDeleteModal(false);
      setBulkActionInput("");
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

        {loading && <p className="text-sm text-text-secondary">Working...</p>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedOrgs.map((org) => {
            const isSelected = selectedOrgIds.has(org.id);
            return (
              <div
                key={org.id}
                className={`tf-card group flex flex-col gap-3 p-5 transition-all duration-300 ${isSelected ? "is-selected" : "hover:border-primary/30"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="tf-selection-checkbox mt-1"
                      checked={isSelected}
                      onChange={() => toggleOrgSelection(org.id)}
                    />
                    <div>
                      <Link
                        href={`/dashboard/orgs/${org.id}`}
                        className="text-base font-semibold text-text-primary hover:text-primary transition-colors"
                      >
                        {org.name}
                      </Link>
                      <p className="text-xs text-text-secondary">
                        {org.role.toLowerCase()} · Created {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/orgs/${org.id}`}
                    className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-secondary/70 transition-colors"
                  >
                    Manage
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tf-pill">{org.role}</span>
                  <span className="tf-pill">Organization</span>
                  {org.role === "OWNER" && (
                    <>
                      <button
                        type="button"
                        className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors"
                        onClick={(event) => {
                          event.preventDefault();
                          setError(null);
                          setRenameTarget(org);
                          setRenameInput(org.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-text-secondary hover:text-destructive transition-colors"
                        onClick={(event) => {
                          event.preventDefault();
                          setError(null);
                          setDeleteTarget(org);
                          setDeleteInput("");
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {!orgs.length && !loading && (
            <div className="tf-card p-5 text-sm text-text-secondary">
              No organizations yet. Create one from the dashboard to get started.
            </div>
          )}
        </section>

        {orgs.length > 5 && (
          <DashboardPagination
            page={orgsPage}
            totalPages={orgsTotalPages}
            pageSize={orgsPageSize}
            pageSizeOptions={ORG_PAGE_SIZE_OPTIONS}
            onPageChange={setOrgsPage}
            onPageSizeChange={(nextSize) => {
              setOrgsPage(1);
              setOrgsPageSize(nextSize);
            }}
          />
        )}
      </div>

      {renameTarget && (
        <div className="tf-modal-backdrop">
          <div className="tf-modal-panel">
            <div className="tf-modal-header">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/20 bg-accent-soft p-2 text-primary shadow-sm">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="tf-modal-title">Rename Organization</h3>
                  <p className="tf-modal-description">Update the organization name for every member.</p>
                </div>
              </div>
            </div>

            <div className="tf-modal-body">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Organization name
              </label>
              <input
                className="tf-input w-full"
                placeholder="e.g. Acme Corp"
                value={renameInput}
                onChange={(event) => setRenameInput(event.target.value)}
                autoFocus
              />
            </div>

            <div className="tf-modal-footer">
              <button
                className="tf-button-ghost min-w-[100px]"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameInput("");
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="tf-button min-w-[120px]"
                onClick={handleRenameOrg}
                disabled={loading || !renameInput.trim()}
              >
                <LoadingButtonContent loading={loading} loadingLabel="Saving..." idleLabel="Save name" />
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Delete Organization</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to delete this organization?</h4>
               <p className="text-sm text-text-secondary">
                 This action is permanent and cannot be undone. Type <span className="font-semibold">{deleteTarget.name}</span> to confirm.
               </p>
               <input
                 className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                 placeholder={deleteTarget.name}
                 value={deleteInput}
                 onChange={(e) => setDeleteInput(e.target.value)}
                 disabled={loading}
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={handleDeleteOrg} 
                 disabled={loading || deleteInput !== deleteTarget.name}
                 className="flex-1 tf-danger-solid disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setDeleteTarget(null)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="tf-modal-backdrop">
          <div className="tf-modal-panel">
            <div className="tf-modal-header">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/20 bg-accent-soft p-2 text-primary shadow-sm">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="tf-modal-title">Create Organization</h3>
                  <p className="tf-modal-description">Create a new organization to manage members and projects.</p>
                </div>
              </div>
            </div>

            <div className="tf-modal-body">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Organization name
              </label>
              <input
                className="tf-input w-full"
                placeholder="e.g. Acme Corp"
                value={newOrgName}
                onChange={(event) => setNewOrgName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="tf-modal-footer">
              <button
                className="tf-button-ghost min-w-[100px]"
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="tf-button min-w-[160px]"
                onClick={handleCreateOrg}
                disabled={loading || !newOrgName.trim()}
              >
                <LoadingButtonContent
                  loading={loading}
                  loadingLabel="Creating..."
                  idleLabel="Create Organization"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="tf-dashboard-toast"
          style={{
            background: toast.tone === "success" ? "#16a34a" : "#dc2626",
            color: "white"
          }}
        >
          {toast.message}
        </div>
      )}
      {selectedOrgIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full border border-border/80 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {selectedOrgIds.size}
            </span>
            <span className="text-sm font-semibold text-text-primary">selected</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <button
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-secondary/80 hover:text-text-primary transition-colors"
              onClick={() => setSelectedOrgIds(new Set())}
            >
              Deselect all
            </button>
            <button
              className="flex items-center gap-1.5 rounded-full bg-destructive-soft border border-destructive-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all
            </button>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary">Delete Organizations</h3>
              <button onClick={() => setShowBulkDeleteModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <h4 className="text-lg sm:text-xl font-bold text-text-primary mb-2">Are you sure you want to delete these organizations?</h4>
               <p className="text-sm text-text-secondary">
                 This action is permanent and cannot be undone. Type <span className="font-semibold">Delete organizations</span> to confirm.
               </p>
               <input
                 className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                 placeholder="Delete organizations"
                 value={bulkActionInput}
                 onChange={(e) => setBulkActionInput(e.target.value)}
                 disabled={loading}
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={handleBulkDeleteOrgs} 
                 disabled={loading || bulkActionInput !== "Delete organizations"}
                 className="flex-1 tf-danger-solid disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setShowBulkDeleteModal(false)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
