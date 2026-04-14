"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Image src="/traceforge-logo.svg" alt="TraceForge" width={22} height={22} />
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

      {menuOpen ? (
        <div className="fixed inset-x-0 top-[73px] bottom-0 z-40 bg-foreground/25 backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            id="dashboard-mobile-more-nav"
            className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] flex max-h-[calc(100dvh-73px-env(safe-area-inset-bottom)-7rem)] flex-col rounded-[28px] border border-border bg-card/95 p-4 shadow-2xl backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  More navigation
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  Jump to the rest of your workspace
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-text-secondary transition hover:text-text-primary"
                onClick={() => setMenuOpen(false)}
                aria-label="Close more navigation"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8" />
                  <path d="M12 4 4 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
              {overflowItems.map((item) => {
                const isActive = isActiveRoute(pathname, item.href);
                const compactLabel =
                  item.label.length > 10 ? `${item.label.slice(0, 8)}...` : item.label;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "border-border/70 bg-card/90 text-primary shadow-sm backdrop-blur"
                        : "border-border bg-background/70 text-text-secondary hover:border-primary/20 hover:text-text-primary"
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary/70">
                      <MobileNavIcon name={item.icon} active={isActive} />
                    </span>
                    <span className="min-w-0 truncate text-[12px] leading-none">{compactLabel}</span>
                  </Link>
                );
              })}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-border bg-background/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Account
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-text-primary">{displayName}</p>
                  <p className="truncate text-xs text-text-secondary">{user?.email}</p>
                </div>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {currentPlanLabel}
                </span>
              </div>

              {usage ? (
                <div className="mt-4 rounded-2xl border border-border bg-card/80 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary">Usage this month</p>
                      <p className="mt-1 text-[11px] text-text-secondary">
                        {usage.plan === "PRO"
                          ? "Unlimited AI"
                          : `${usage.used} used • ${usage.remaining} left`}
                      </p>
                    </div>
                    <span className="rounded-full border border-border bg-secondary/60 px-2 py-1 text-[11px] font-semibold text-text-secondary">
                      {usage.limit ? `${Math.min(99, Math.max(0, usage.percentUsed))}%` : "∞"}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_3rem] gap-3">
                <Link
                  href="/dashboard/account/details"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-text-primary transition hover:border-primary/20 hover:bg-card/90"
                >
                  Account details
                </Link>
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/0.18)]"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    router.push("/signin");
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-xl backdrop-blur lg:hidden"
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
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[11px] font-semibold transition ${
                  isActive
                    ? "border-border/70 bg-card/90 text-primary shadow-sm backdrop-blur"
                    : "border-transparent text-text-secondary hover:bg-card/90 hover:text-text-primary"
                }`}
              >
                <MobileNavIcon name={item.icon} active={isActive} />
                <span className="truncate">{item.mobileLabel || item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[11px] font-semibold transition ${
              menuOpen || activeOverflowItem
                ? "border-border/70 bg-card/90 text-primary shadow-sm backdrop-blur"
                : "border-transparent text-text-secondary hover:bg-card/90 hover:text-text-primary"
            }`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="dashboard-mobile-more-nav"
            aria-label="Open more navigation"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
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
            <span className="truncate text-[10px] leading-none">{activeOverflowLabel}</span>
          </button>
        </div>
      </div>
    </>
  );
}
