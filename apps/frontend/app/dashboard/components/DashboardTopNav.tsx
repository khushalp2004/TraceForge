"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalSearch } from "../../components/GlobalSearchProvider";

const baseTopNavItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/issues", label: "Issues" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/orgs", label: "Organization" },
  { href: "/dashboard/repo-analysis", label: "Repo Analysis" },
  { href: "/dashboard/releases", label: "Releases" },
  { href: "/dashboard/insights", label: "Insights" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/docs", label: "Docs" }
];

const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
};

export default function DashboardTopNav() {
  const { user, logout } = useAuth();
  const { openSearch } = useGlobalSearch();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.fullName?.trim() || user?.email?.split("@")[0] || "Account";
  const initials = useMemo(() => {
    const source = user?.fullName?.trim() || user?.email || "TF";
    const parts = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "TF";
    return parts.map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2);
  }, [user?.email, user?.fullName]);

  const topNavItems = useMemo(() => {
    if (!user?.isSuperAdmin) {
      return baseTopNavItems;
    }

    const organizationIndex = baseTopNavItems.findIndex((item) => item.href === "/dashboard/orgs");
    const nextItems = [...baseTopNavItems];
    nextItems.splice(organizationIndex + 1, 0, {
      href: "/dashboard/admin",
      label: "Admin"
    });
    return nextItems;
  }, [user?.isSuperAdmin]);

  const primaryItems = useMemo(() => topNavItems.slice(0, 6), [topNavItems]);
  const overflowItems = useMemo(() => topNavItems.slice(6), [topNavItems]);
  const activeOverflowItem = useMemo(
    () => overflowItems.find((item) => isActiveRoute(pathname, item.href)) ?? null,
    [overflowItems, pathname]
  );

  useEffect(() => {
    if (!profileOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  useEffect(() => {
    if (!moreOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setProfileOpen(false);
  }, [pathname]);

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
    <div className="fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur lg:block">
      <div className="tf-dashboard">
        <div className="flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Image src="/traceforge-logo.svg" alt="TraceForge" width={22} height={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
                Workspace
              </p>
              <p className="truncate text-sm font-semibold text-text-primary">TraceForge</p>
            </div>
          </Link>

          <nav className="flex flex-1 items-center justify-center gap-1">
            {primaryItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-accent-soft text-text-primary"
                      : "text-text-secondary hover:bg-secondary/70 hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  moreOpen || activeOverflowItem
                    ? "bg-accent-soft text-text-primary"
                    : "text-text-secondary hover:bg-secondary/70 hover:text-text-primary"
                }`}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-controls="dashboard-topnav-more"
              >
                <span>More</span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card/80">
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M8 3.5v9" />
                    <path d="M3.5 8h9" />
                  </svg>
                </span>
              </button>

              {moreOpen ? (
                <div
                  id="dashboard-topnav-more"
                  role="menu"
                  className="absolute left-1/2 top-[calc(100%+12px)] z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-2xl backdrop-blur"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      More navigation
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      Jump to the rest of your workspace
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {overflowItems.map((item) => {
                      const active = isActiveRoute(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMoreOpen(false)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                            active
                              ? "border-primary/30 bg-accent-soft text-text-primary"
                              : "border-border bg-secondary/20 text-text-secondary hover:bg-secondary/35 hover:text-text-primary"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openSearch()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text-secondary shadow-sm transition hover:border-primary/25 hover:text-text-primary"
              aria-label="Open global search"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35"
                />
              </svg>
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-text-secondary shadow-sm transition hover:border-primary/25 hover:text-text-primary"
                aria-label="Open account menu"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-xs font-bold text-text-primary">
                  {initials}
                </span>
                <span className="hidden max-w-[160px] truncate xl:inline">{displayName}</span>
                <svg
                  aria-hidden="true"
                  className={`h-4 w-4 transition ${profileOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M6 8l4 4 4-4" />
                </svg>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-3xl border border-border bg-card/95 shadow-xl backdrop-blur">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary">{displayName}</p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={openSettings}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    >
                      Account settings
                      <span className="text-xs text-text-secondary">⌘</span>
                    </button>
                    <Link
                      href="/docs"
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                      onClick={() => setProfileOpen(false)}
                    >
                      Documentation
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
