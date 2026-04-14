"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalSearch } from "../../components/GlobalSearchProvider";

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

const baseNavItems = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/issues", label: "Issues", icon: "issues" },
  { href: "/dashboard/projects", label: "Projects", icon: "projects" },
  { href: "/dashboard/orgs", label: "Organization", icon: "team" },
  { href: "/dashboard/releases", label: "Releases", icon: "releases" },
  { href: "/dashboard/insights", label: "Insights", icon: "insights" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "alerts" },
  { href: "/dashboard/repo-analysis", label: "Repo Analysis", icon: "repo-analysis" },
  { href: "/docs", label: "Documentation", icon: "docs" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing" }
];

const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
};

const baseLink =
  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition";
const activeLink = "bg-card text-text-primary shadow-sm";
const inactiveLink =
  "text-text-secondary hover:bg-secondary/70 hover:text-text-primary";

function NavIcon({
  name,
  isActive,
  collapsed
}: {
  name: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  const common = `transition ${
    collapsed ? "h-6 w-6 group-hover/nav:h-4 group-hover/nav:w-4" : "h-4 w-4"
  } ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`;
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
          <path d="M9.5 11.5 11.2 13l3.3-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function UsageRing({
  used,
  limit,
  percentUsed
}: {
  used: number;
  limit: number | null;
  percentUsed: number;
}) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = limit ? circumference - (Math.min(100, percentUsed) / 100) * circumference : circumference * 0.72;

  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="4" className="text-border/80" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          className={limit ? "text-primary" : "text-emerald-400"}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-text-primary">
        {limit ? `${Math.min(99, Math.max(0, percentUsed))}%` : "∞"}
      </span>
    </div>
  );
}

export default function DashboardSidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout, token } = useAuth();
  const { openSearch } = useGlobalSearch();
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const navItems = useMemo(
    () => {
      if (!user?.isSuperAdmin) {
        return baseNavItems;
      }

      const organizationIndex = baseNavItems.findIndex((item) => item.href === "/dashboard/orgs");
      const nextItems = [...baseNavItems];
      nextItems.splice(organizationIndex + 1, 0, {
        href: "/dashboard/admin",
        label: "Admin Panel",
        icon: "shield"
      });
      return nextItems;
    },
    [user?.isSuperAdmin]
  );
  const profileRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.fullName?.trim() || user?.email?.split("@")[0] || "Account";
  const initials = useMemo(() => {
    const source = user?.fullName?.trim() || user?.email || "TF";
    const parts = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return "TF";
    }

    return parts.map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2);
  }, [user?.email, user?.fullName]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncSelectedOrg = () => {
      try {
        const raw = window.localStorage.getItem(dashboardPrefsKey);
        if (!raw) {
          setSelectedOrgId("");
          return;
        }
        const parsed = JSON.parse(raw) as { orgId?: string };
        setSelectedOrgId(typeof parsed.orgId === "string" ? parsed.orgId : "");
      } catch {
        setSelectedOrgId("");
      }
    };

    syncSelectedOrg();
    const intervalId = window.setInterval(syncSelectedOrg, 1200);
    window.addEventListener("focus", syncSelectedOrg);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncSelectedOrg);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUsage(null);
      return;
    }

    let cancelled = false;
    const query = selectedOrgId ? `?orgId=${encodeURIComponent(selectedOrgId)}` : "";

    const loadUsage = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/usage${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = (await res.json()) as { usage?: UsageSummary; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Failed to load usage");
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
    const intervalId = window.setInterval(() => {
      void loadUsage();
    }, 8000);
    const handleFocus = () => {
      void loadUsage();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [token, selectedOrgId, pathname]);

  const openSettings = () => {
    setProfileOpen(false);
    router.push("/dashboard/account/details");
  };

  const handleSignOut = () => {
    setProfileOpen(false);
    logout();
    router.replace("/signin");
  };

  return (
    <aside
      className={`tf-sidebar relative hidden min-h-0 flex-col border-r border-border bg-sidebar/80 px-5 py-6 transition-[width] duration-200 ease-out lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex ${
        collapsed ? "tf-sidebar-collapsed w-[85px]" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-[-16px] top-1/2 z-50 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl border border-border/80 bg-transparent text-text-secondary shadow-sm transition hover:border-primary/30 hover:bg-secondary/30 hover:text-text-primary"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {collapsed ? <path d="M6 3.5 10.5 8 6 12.5" /> : <path d="M10 3.5 5.5 8 10 12.5" />}
        </svg>
      </button>
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div
          className={`rounded-2xl border border-border bg-card shadow-sm ${
            collapsed ? "px-2 py-2" : "px-3 py-3"
          }`}
        >
          <Link href="/" className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center rounded-full bg-primary/10 ${
                collapsed ? "h-8 w-8" : "h-9 w-9"
              }`}
            >
              <Image src="/traceforge-logo.svg" alt="TraceForge" width={22} height={22} />
            </div>
            <div className={`min-w-0 ${collapsed ? "hidden tf-reveal-block" : "block"}`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                Workspace
              </p>
              <p className="truncate text-sm font-semibold text-text-primary">
                TraceForge
              </p>
            </div>
          </Link>
        </div>

        <button
          className={`flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm transition hover:border-primary/40 hover:text-text-primary ${
            collapsed ? "justify-center group-hover/nav:justify-start" : ""
          }`}
          type="button"
          onClick={() => openSearch()}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.65" y1="16.65" x2="21" y2="21" />
          </svg>
          <span className={`${collapsed ? "hidden tf-reveal-inline" : ""}`}>Search</span>
          <span
            className={`ml-auto rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-text-secondary ${
              collapsed ? "hidden tf-reveal-inline-flex" : ""
            }`}
          >
            /
          </span>
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <nav className="tf-sidebar-nav group/nav flex flex-col gap-2 text-sm">
            {navItems.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  className={`${baseLink} group ${isActive ? activeLink : inactiveLink} ${
                    collapsed ? "justify-center group-hover/nav:justify-start px-2 py-3" : ""
                  }`}
                  href={item.href}
                >
                  <NavIcon name={item.icon} isActive={isActive} collapsed={collapsed} />
                  <span className={`${collapsed ? "hidden tf-reveal-inline" : ""}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {usage ? (
        collapsed ? (
          <div className="group/usage relative mt-5 flex justify-center">
            <button
              type="button"
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/30 hover:bg-secondary/50"
              aria-label="View monthly usage"
            >
              <UsageRing used={usage.used} limit={usage.limit} percentUsed={usage.percentUsed} />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden w-56 -translate-y-1/2 rounded-2xl border border-border bg-card/95 p-3 text-xs text-text-secondary shadow-xl backdrop-blur group-hover/usage:block group-focus-within/usage:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                Usage this month
              </p>
              <p className="mt-2 font-semibold text-text-primary">
                {usage.plan === "PRO" ? "Unlimited AI" : `${usage.used} used / ${usage.limit} total`}
              </p>
              <p className="mt-1">
                {usage.plan === "PRO"
                  ? "Your Pro plan includes unlimited AI analyses everywhere in TraceForge."
                  : `${usage.remaining} left this month.`}
              </p>
              <p className="mt-2">{usage.detail}</p>
            </div>
          </div>
        ) : (
          <div className="relative mt-5 rounded-2xl border border-border bg-card px-3 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <UsageRing used={usage.used} limit={usage.limit} percentUsed={usage.percentUsed} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary">Usage this month</p>
                <p className="mt-1 truncate text-xs text-text-secondary">
                  {usage.plan === "PRO"
                    ? "Unlimited AI analysis"
                    : `${usage.label} · ${
                        usage.plan === "TEAM" ? "Team plan" : usage.plan === "DEV" ? "Dev plan" : "Free plan"
                      }`}
                </p>
              </div>
            </div>
          </div>
        )
      ) : null}

      <div className="relative mt-5" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-secondary/50 ${
            collapsed ? "justify-center px-2 group-hover/nav:justify-start" : ""
          }`}
          aria-label="Open profile menu"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-sm font-bold text-text-primary">
            {initials}
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? "hidden tf-reveal-block" : "block"}`}>
            <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
            <p className="truncate text-xs text-text-secondary">{user?.email || "Signed in"}</p>
          </div>
          <svg
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-text-secondary transition ${
              profileOpen ? "rotate-180" : ""
            } ${collapsed ? "hidden tf-reveal-block" : "block"}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {profileOpen && (
          <div
            className={`absolute bottom-[calc(100%+0.75rem)] z-50 w-64 rounded-3xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur ${
              collapsed ? "left-full ml-3" : "left-0 right-0"
            }`}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/35 px-3 py-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-base font-bold text-text-primary">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
                <p className="truncate text-xs text-text-secondary">{user?.email}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-text-primary transition hover:bg-secondary/60"
                onClick={openSettings}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.7-1l-.3-2.4h-4l-.3 2.4a7 7 0 0 0-1.7 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7 7 0 0 0 1.7-1l2.3.7 2-3.5-2-1.5c.07-.33.1-.66.1-1z" />
                </svg>
                Account Details
              </button>

              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-3 text-sm font-semibold text-text-primary transition hover:border-[hsl(var(--destructive-border))] hover:bg-[hsl(var(--destructive-soft))] hover:text-[hsl(var(--destructive))]"
                onClick={handleSignOut}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-text-secondary transition group-hover:text-[hsl(var(--destructive))]"
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
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
