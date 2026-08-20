"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";
import { Trash2, Edit3, PlusCircle, X } from "lucide-react";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

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
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Manage Organizations</h1>
            <PageDescriptionPopover>
              Create and manage your teams, members, and permissions.
              <br /><br />
              Select an organization to view detailed membership settings and activity.
            </PageDescriptionPopover>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-sm bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border/40 hover:text-text-primary hover:border-border transition shadow-sm"
              onClick={() => setShowCreateModal(true)}
            >
              Create organization
            </button>
          </div>
        </header>

        {loading && <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse"><span className="tf-status-dot bg-primary" />Working...</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedOrgs.map((org, index) => {
            const isSelected = selectedOrgIds.has(org.id);
            return (
              <div
                key={org.id}
                className={`group flex min-w-0 flex-col p-6 sm:p-8 transition-all duration-500 ease-out rounded-[24px] border animate-stagger-fade-up ${
                  isSelected 
                    ? "border-primary/50 bg-primary/5 shadow-lg" 
                    : "border-border/40 bg-gradient-to-b from-card to-card/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:border-border/80 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.15)] hover:-translate-y-[2px]"
                }`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {/* Top Section */}
                <div className="flex flex-col gap-6">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-4 relative">
                    <div className="flex items-center gap-3 min-w-0">
                      <label className="relative flex cursor-pointer items-center group/checkbox shrink-0">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isSelected}
                          onChange={() => toggleOrgSelection(org.id)}
                        />
                        <div className={`h-[18px] w-[18px] rounded-full border transition-all flex items-center justify-center ${
                          isSelected 
                            ? "border-primary bg-primary text-primary-foreground" 
                            : "border-text-secondary/40 hover:border-text-secondary/80 bg-secondary/20 text-transparent"
                        }`}>
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </label>
                      <h2 className="text-[17px] font-semibold text-text-primary truncate tracking-tight">{org.name}</h2>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ${
                          org.role === "OWNER" ? "border-amber-500/30 text-amber-600 bg-amber-500/10 border" : "border-border text-text-secondary bg-secondary/30 border"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
                        {org.role}
                      </span>
                    </div>
                    
                    <Link
                      href={`/dashboard/orgs/${org.id}`}
                      className="p-2.5 rounded-full bg-secondary/20 hover:bg-secondary/60 text-text-secondary hover:text-text-primary transition-all duration-300 cursor-pointer shadow-sm border border-border/30 hover:border-border/60 hover:scale-105 shrink-0"
                      title="View Details"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
                    </Link>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary/70 uppercase tracking-[0.15em]">
                      <span>Type</span>
                    </div>
                    <div className="font-mono text-[14px] font-medium text-text-primary/90 truncate bg-secondary/10 px-4 py-3 rounded-[16px] border border-border/40 shadow-inner">
                      Organization
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                  <div className="text-[12px] font-medium text-text-secondary/60">
                    Created {new Date(org.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-4">
                    {org.role === "OWNER" && (
                      <button
                        className="text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                        onClick={(event) => {
                          event.preventDefault();
                          setError(null);
                          setRenameTarget(org);
                          setRenameInput(org.name);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    {org.role === "OWNER" && (
                      <button
                        className="text-[12px] font-medium text-destructive hover:text-destructive/80 transition-colors"
                        onClick={(event) => {
                          event.preventDefault();
                          setError(null);
                          setDeleteTarget(org);
                          setDeleteInput("");
                        }}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!orgs.length && !loading && (
            <div className="col-span-full rounded-[24px] border border-dashed border-border/40 bg-secondary/10 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30">
                <svg aria-hidden="true" className="h-6 w-6 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M4 19a5 5 0 0 1 10 0" strokeLinecap="round" /><path d="M14.5 19a4 4 0 0 1 7 0" strokeLinecap="round" /></svg>
              </div>
              <p className="text-base font-semibold text-text-primary">No organizations yet</p>
              <p className="mt-1 text-sm text-text-secondary">Create one from the dashboard to get started with team collaboration.</p>
            </div>
          )}
        </section>

        {orgs.length > 5 && (
          <div className="mt-6 border-t border-border/40 pt-4">
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
          </div>
        )}
      </div>

      {renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-md border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Rename Organization</h3>
              <button onClick={() => {
                  setRenameTarget(null);
                  setRenameInput("");
                }} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <p className="text-sm text-text-secondary mb-4">Update the organization name for every member.</p>
               <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                 Organization name
               </label>
               <input
                 className="w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                 placeholder="e.g. Acme Corp"
                 value={renameInput}
                 onChange={(event) => setRenameInput(event.target.value)}
                 autoFocus
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={handleRenameOrg} 
                 disabled={loading || !renameInput.trim()}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={loading} loadingLabel="Saving..." idleLabel="Save name" />
               </button>
               <button 
                 onClick={() => {
                   setRenameTarget(null);
                   setRenameInput("");
                 }} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-md border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
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
                 className="mt-4 w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
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
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2 px-4 rounded-sm transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setDeleteTarget(null)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg max-h-[70vh] sm:max-h-[90vh] rounded-md border border-border/40 bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">Create Organization</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               <p className="text-sm text-text-secondary mb-4">Create a new organization to manage members and projects.</p>
               <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                 Organization name
               </label>
               <input
                 className="w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                 placeholder="e.g. Acme Corp"
                 value={newOrgName}
                 onChange={(event) => setNewOrgName(event.target.value)}
                 autoFocus
               />
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-4 border-t border-border/50 shrink-0">
               <button 
                 onClick={handleCreateOrg} 
                 disabled={loading || !newOrgName.trim()}
                 className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 <LoadingButtonContent loading={loading} loadingLabel="Creating..." idleLabel="Create Organization" />
               </button>
               <button 
                 onClick={() => setShowCreateModal(false)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast animate-fade-up ${
            toast.tone === "success"
              ? "bg-[hsl(var(--success))] text-white"
              : "bg-[hsl(var(--destructive))] text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
      {selectedOrgIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex w-max max-w-[95vw] items-center gap-2 sm:gap-4 rounded-full border border-border/80 bg-card/95 px-3 py-2 sm:px-4 sm:py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] sm:text-xs font-bold text-primary">
              {selectedOrgIds.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-text-primary hidden sm:inline">selected</span>
          </div>
          <div className="h-4 w-px bg-border/60 hidden sm:block" />
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              className="rounded-full px-2 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-text-secondary hover:bg-secondary/80 hover:text-text-primary transition-colors whitespace-nowrap"
              onClick={() => setSelectedOrgIds(new Set())}
            >
              Deselect all
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-destructive-soft border border-destructive-border px-2 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 whitespace-nowrap"
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              Delete all
            </button>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-md border border-border bg-card shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
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
                 className="mt-4 w-full rounded-sm border border-border bg-secondary/20 px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
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
                 className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2 px-4 rounded-sm transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setShowBulkDeleteModal(false)} 
                 disabled={loading}
                 className="flex-1 bg-secondary/50 border border-border hover:bg-secondary/80 text-text-primary font-semibold py-2 px-4 rounded-sm transition-colors flex items-center justify-center"
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
