"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalSearch } from "../../components/GlobalSearchProvider";

const baseMobileItems = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/issues", label: "Issues", icon: "issues" },
  { href: "/dashboard/projects", label: "Projects", icon: "projects" },
  { href: "/dashboard/orgs", label: "Organization", mobileLabel: "Orgs", icon: "team" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "alerts" },
  { href: "/dashboard/releases", label: "Releases", icon: "releases" },
  { href: "/dashboard/insights", label: "Insights", icon: "insights" },
  { href: "/dashboard/repo-analysis", label: "Repo Analysis", mobileLabel: "Repo", icon: "repo-analysis" },
  { href: "/docs", label: "Documentation", icon: "docs" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing" },
  { href: "/dashboard/admin", label: "Admin", icon: "shield" }
];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const dashboardPrefsKey = "traceforge_dashboard_prefs_v1";

type UsageSummary = {
  scope: "USER" | "ORGANIZATION";
  plan: "FREE" | "DEV" | "PRO" | "TEAM";
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number;
  label: string;
  detail: string;
};

const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
};

function MobileNavIcon({
  name,
  active,
  className = "h-4 w-4"
}: {
  name: string;
  active: boolean;
  className?: string;
}) {
  const tone = active ? "text-primary" : "text-text-secondary";
  const common = `${className} ${tone}`;

  switch (name) {
    case "overview":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "issues":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      );
    case "projects":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7.5h7l2 2H21v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M3 7.5a2 2 0 0 1 2-2h5l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "releases":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path d="M6 10.5l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 4.5v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 19.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "insights":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path d="M4 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 19V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 19V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M22 19V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "alerts":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4a5 5 0 0 0-5 5v2.5L5 14v1h14v-1l-2-2.5V9a5 5 0 0 0-5-5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "team":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 19a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14.5 19a4 4 0 0 1 7 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "repo-analysis":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M8 7.5h8M8 12h6M8 16.5h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "docs":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path d="M6 4h8a3 3 0 0 1 3 3v13H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.7-1l-.3-2.4h-4l-.3 2.4a7 7 0 0 0-1.7 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7 7 0 0 0 1.7-1l2.3.7 2-3.5-2-1.5c.07-.33.1-.66.1-1z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "billing":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.8" />
          <line x1="7" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3l7 3v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 11.5 11.2 13l3.3-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

export default function DashboardMobileNav() {
  const { user, token, logout } = useAuth();
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const { openSearch } = useGlobalSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const mobileItems = useMemo(
    () => (user?.isSuperAdmin ? baseMobileItems : baseMobileItems.filter((item) => item.href !== "/dashboard/admin")),
    [user?.isSuperAdmin]
  );
  const primaryItems = mobileItems.slice(0, 4);
  const overflowItems = mobileItems.slice(4);
  const activeOverflowItem = useMemo(
    () => overflowItems.find((item) => isActiveRoute(pathname, item.href)) ?? null,
    [overflowItems, pathname]
  );
  const activeOverflowLabel = activeOverflowItem
    ? activeOverflowItem.label.length > 10
      ? `${activeOverflowItem.label.slice(0, 8)}...`
      : activeOverflowItem.label
    : "More";
  const displayName = user?.fullName?.trim() || user?.email?.split("@")[0] || "Account";
  const currentPlanLabel =
    user?.plan === "PRO" ? "Pro" : user?.plan === "DEV" ? "Dev" : user?.plan === "TEAM" ? "Team" : "Free";

  useEffect(() => {
    if (!token) {
      setUsage(null);
      return;
    }

    let cancelled = false;
    let selectedOrgId = "";
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(dashboardPrefsKey);
        const parsed = raw ? (JSON.parse(raw) as { orgId?: string }) : {};
        selectedOrgId = typeof parsed.orgId === "string" ? parsed.orgId : "";
      } catch {
        selectedOrgId = "";
      }
    }

    const query = selectedOrgId ? `?orgId=${encodeURIComponent(selectedOrgId)}` : "";

    const loadUsage = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/usage${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = (await res.json()) as { usage?: UsageSummary };
        if (!res.ok) {
          throw new Error("Failed to load usage");
        }
        if (!cancelled) {
          setUsage(data.usage || null);
        }
      } catch {
        if (!cancelled) {
          setUsage(null);
        }
      }
    };

    void loadUsage();
    window.addEventListener("focus", loadUsage);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadUsage);
    };
  }, [token]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 lg:hidden">
        <div className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 transition-all duration-200">
                <Image 
                  src="/traceforge-logo.svg" 
                  alt="TraceForge" 
                  width={22} 
                  height={22} 
                  className="h-[22px] w-[22px] object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
                  Workspace
                </p>
                <p className="truncate text-sm font-semibold text-text-primary">TraceForge</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => openSearch()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-secondary shadow-sm transition hover:border-primary/25 hover:text-text-primary"
              aria-label="Open global search"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-[73px] bottom-0 z-40 bg-foreground/20 backdrop-blur-md lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              id="dashboard-mobile-more-nav"
              className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] flex max-h-[calc(100dvh-73px-env(safe-area-inset-bottom)-6.5rem)] flex-col overflow-hidden rounded-[32px] border border-border/50 bg-background/85 shadow-2xl backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full bg-text-secondary/20" />

              <div className="flex-1 overflow-y-auto pb-2">
                {/* User Profile Row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-[15px] font-medium text-text-primary">
                      {displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-text-primary">{displayName || 'User'}</p>
                      <p className="truncate text-[13px] text-text-secondary">{user?.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    {currentPlanLabel}
                  </span>
                </div>

                <div className="mx-5 h-[1px] bg-border/40" />

                {/* Navigation Links */}
                <div className="flex flex-col px-2 py-2">
                  {overflowItems.map((item) => {
                    const isActive = isActiveRoute(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-4 rounded-[20px] px-3 py-3 transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-secondary/40 hover:text-text-primary"
                        }`}
                      >
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-transparent' : 'bg-transparent'}`}>
                          <MobileNavIcon name={item.icon} active={isActive} />
                        </span>
                        <span className="text-[15px] font-medium leading-none">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {usage && (
                  <>
                    <div className="mx-5 h-[1px] bg-border/40" />
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-[14px] font-medium text-text-primary">Usage</p>
                        <p className="mt-0.5 text-[12px] text-text-secondary">
                          {usage.plan === "PRO"
                            ? "Unlimited AI"
                            : `${usage.used} used • ${usage.remaining} left`}
                        </p>
                      </div>
                      <span className="text-[14px] font-medium text-text-secondary">
                        {usage.limit ? `${Math.min(99, Math.max(0, usage.percentUsed))}%` : "∞"}
                      </span>
                    </div>
                  </>
                )}

                <div className="mx-5 h-[1px] bg-border/40" />

                {/* Bottom Actions */}
                <div className="flex flex-col px-2 pt-2">
                  <Link
                    href="/dashboard/account/details"
                    className="flex items-center gap-4 rounded-[20px] px-3 py-3.5 text-text-secondary transition-colors hover:bg-secondary/40 hover:text-text-primary"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <span className="text-[15px] font-medium leading-none">Account details</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      router.push("/signin");
                    }}
                    className="flex items-center gap-4 rounded-[20px] px-3 py-3.5 text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/0.1)]"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
                    </span>
                    <span className="text-[15px] font-medium leading-none">Sign out</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="fixed inset-x-3 bottom-3 z-40 rounded-[24px] border border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-xl backdrop-blur lg:hidden"
        role="navigation"
        aria-label="Mobile dashboard navigation"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-2 px-1 pb-1">
          {primaryItems.map((item) => {
            const isActive = isActiveRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-col items-center justify-center rounded-[20px] border border-transparent px-2 py-1.5 text-[10px] sm:text-[11px] font-semibold transition ${
                  isActive
                    ? "text-primary"
                    : "text-text-secondary hover:bg-secondary/30 hover:text-text-primary"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-active-bg"
                    className="absolute inset-0 z-0 rounded-[20px] bg-secondary/40"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <div className="relative z-10 flex w-full min-w-0 flex-col items-center gap-1">
                  <MobileNavIcon name={item.icon} active={isActive} />
                  <span className="w-full truncate text-center">{item.mobileLabel || item.label}</span>
                </div>
              </Link>
            );
          })}

          <button
            type="button"
            className={`relative flex min-w-0 flex-col items-center justify-center rounded-[20px] border border-transparent px-2 py-1.5 text-[10px] sm:text-[11px] font-semibold transition ${
              menuOpen || activeOverflowItem
                ? "text-primary"
                : "text-text-secondary hover:bg-secondary/30 hover:text-text-primary"
            }`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="dashboard-mobile-more-nav"
            aria-label="Open more navigation"
          >
            {(menuOpen || activeOverflowItem) && (
              <motion.div
                layoutId="mobile-nav-active-bg"
                className="absolute inset-0 z-0 rounded-[20px] bg-secondary/40"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <div className="relative z-10 flex w-full min-w-0 flex-col items-center gap-1">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <svg
                  aria-hidden="true"
                  className={`h-4 w-4 transition ${menuOpen ? "rotate-45" : ""}`}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M8 3v10" />
                  <path d="M3 8h10" />
                </svg>
              </span>
              <span className="w-full truncate text-center text-[10px] leading-none">{activeOverflowLabel}</span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
