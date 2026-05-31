"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CircleAlert,
  FolderKanban,
  Rocket,
  LineChart,
  Bell,
  Users,
  GitPullRequest,
  BookOpen,
  Settings,
  CreditCard,
  ShieldCheck,
  Search,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  UserCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { LayoutDashboard as AnimatedLayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard";
import { MessageCircleWarning as AnimatedMessageCircleWarning } from "@/components/animate-ui/icons/message-circle-warning";
import { SquareKanban as AnimatedSquareKanban } from "@/components/animate-ui/icons/square-kanban";
import { Users as AnimatedUsers } from "@/components/animate-ui/icons/users";
import { ChartLine as AnimatedChartLine } from "@/components/animate-ui/icons/chart-line";
import { Bell as AnimatedBell } from "@/components/animate-ui/icons/bell";
import { ClipboardList as AnimatedClipboardList } from "@/components/animate-ui/icons/clipboard-list";
import { Settings as AnimatedSettings } from "@/components/animate-ui/icons/settings";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
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

const navIconMap = {
  overview: LayoutDashboard,
  issues: CircleAlert,
  projects: FolderKanban,
  releases: Rocket,
  insights: LineChart,
  alerts: Bell,
  team: Users,
  "repo-analysis": GitPullRequest,
  docs: BookOpen,
  settings: Settings,
  billing: CreditCard,
  shield: ShieldCheck,
} as const;

function NavIcon({
  name,
  isActive,
  collapsed
}: {
  name: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  const common = `transition-all duration-300 ease-out will-change-transform ${
    collapsed ? "h-4 w-4 group-hover/nav:h-[18px] group-hover/nav:w-[18px]" : "h-[18px] w-[18px]"
  } ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`;
  
  if (name === "overview") return <AnimatedLayoutDashboard className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "issues") return <AnimatedMessageCircleWarning className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "projects") return <AnimatedSquareKanban className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "team") return <AnimatedUsers className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "insights") return <AnimatedChartLine className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "alerts") return <AnimatedBell className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "repo-analysis") return <AnimatedClipboardList className={common} strokeWidth={isActive ? 2.5 : 2} />;
  if (name === "settings") return <AnimatedSettings className={common} strokeWidth={isActive ? 2.5 : 2} />;

  const Icon = navIconMap[name as keyof typeof navIconMap] || Circle;
  return <Icon className={common} strokeWidth={isActive ? 2.5 : 2} />;
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
  const radius = 17.5;
  const circumference = 2 * Math.PI * radius;
  const progress = limit ? circumference - (Math.min(100, percentUsed) / 100) * circumference : circumference * 0.72;
  const isDanger = limit && percentUsed >= 90;
  const isWarning = limit && percentUsed >= 75 && percentUsed < 90;

  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg className="h-10 w-10 -rotate-90 drop-shadow-sm" viewBox="0 0 44 44" fill="none">
        <defs>
          <linearGradient id="usageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={limit ? (isDanger ? "hsl(var(--destructive))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))") : "#34d399"} />
            <stop offset="100%" stopColor={limit ? (isDanger ? "hsl(var(--destructive-border))" : isWarning ? "hsl(var(--warning-border))" : "hsl(var(--primary-hover))") : "#10b981"} />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="3" className="text-border/40" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="url(#usageGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-tighter text-text-primary">
        {limit ? `${Math.min(99, Math.max(0, Math.round(percentUsed)))}%` : "∞"}
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
      className={`tf-sidebar group/sidebar relative hidden min-h-0 flex-col border-r border-border bg-sidebar/80 px-5 py-6 transition-[width] duration-200 ease-out lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex ${
        collapsed ? "tf-sidebar-collapsed w-[85px]" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-[-14px] top-1/2 z-50 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-text-secondary shadow-md transition hover:border-primary/40 hover:bg-secondary/80 hover:text-text-primary"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div
          className={`rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 ${
            collapsed ? "px-2 py-2 group-hover/nav:px-3 group-hover/nav:py-3" : "px-3 py-3"
          }`}
        >
          <Link href="/" className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center rounded-full bg-primary/10 ${
                collapsed ? "h-8 w-8" : "h-9 w-9"
              }`}
            >
              <Image src="https://res.cloudinary.com/drri6ut0i/image/upload/v1779566028/traceforge/traceforge-logo.png" alt="TraceForge" width={22} height={22} onContextMenu={(e) => e.preventDefault()} draggable={false} className="pointer-events-none select-none" />
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
          className={`flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm transition-all duration-200 hover:border-primary/40 hover:text-text-primary ${
            collapsed ? "justify-center px-2 group-hover/nav:justify-start group-hover/nav:px-3" : ""
          }`}
          type="button"
          onClick={() => openSearch()}
        >
          <Search className="h-4 w-4 text-text-secondary" strokeWidth={2} />
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
              const MotionLink = motion(Link);
              return (
                <AnimateIcon key={item.href} animateOnHover asChild>
                  <MotionLink
                    className={`${baseLink} group ${isActive ? activeLink : inactiveLink} transition-all duration-200 ${
                      collapsed ? "justify-center px-2 py-3 group-hover/nav:justify-start group-hover/nav:px-3 group-hover/nav:py-2" : ""
                    }`}
                    href={item.href}
                    initial="rest"
                    whileHover="hover"
                    animate="rest"
                  >
                    {["overview", "issues", "projects", "team", "insights", "alerts", "repo-analysis", "settings"].includes(item.icon) ? (
                      <NavIcon name={item.icon} isActive={isActive} collapsed={collapsed} />
                    ) : (
                      <motion.div
                        variants={{
                          rest: { scale: 1, rotate: 0, y: 0 },
                          hover: { 
                            scale: 1.15, 
                            rotate: [0, -8, 8, -4, 4, 0], 
                            y: -1.5,
                            transition: { 
                              duration: 0.5, 
                              ease: "easeInOut"
                            } 
                          }
                        }}
                      >
                        <NavIcon name={item.icon} isActive={isActive} collapsed={collapsed} />
                      </motion.div>
                    )}
                    <span className={`${collapsed ? "hidden tf-reveal-inline" : ""}`}>
                      {item.label}
                    </span>
                  </MotionLink>
                </AnimateIcon>
              );
            })}
          </nav>
        </div>
      </div>

      {usage ? (
        <div className={`group/usage relative mt-5 rounded-2xl transition-all duration-200 ${
          collapsed 
            ? "border border-transparent bg-transparent shadow-none p-2 group-hover/nav:border-border group-hover/nav:bg-card group-hover/nav:px-3 group-hover/nav:py-3 group-hover/nav:shadow-sm" 
            : "border border-border bg-card px-3 py-3 shadow-sm"
        }`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center group-hover/nav:justify-start" : ""}`}>
            <div className="cursor-help">
              <UsageRing used={usage.used} limit={usage.limit} percentUsed={usage.percentUsed} />
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? "hidden tf-reveal-block" : "block"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-text-primary">Usage</p>
                <span className={`text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${usage.plan === "PRO" ? "bg-primary/15 text-primary" : "bg-secondary text-text-secondary"}`}>
                  {usage.plan}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-text-secondary">
                {usage.plan === "PRO"
                  ? "Unlimited AI analysis"
                  : `${usage.used} / ${usage.limit} used`}
              </p>
            </div>
          </div>
          
          {collapsed && (
            <div className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 hidden w-64 -translate-y-1/2 rounded-[24px] border border-border/50 bg-card/90 p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl group-hover/usage:block group-focus-within/usage:block group-hover/nav:hidden">
              <div className="absolute top-1/2 -left-[5px] h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-border/50 bg-card"></div>
              
              <div className="relative z-10 flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                  Workspace Usage
                </p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  usage.plan === "PRO" ? "bg-primary/20 text-primary" : "bg-secondary text-text-secondary"
                }`}>
                  {usage.plan}
                </span>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-end gap-1.5 font-display text-2xl font-bold text-text-primary">
                  {usage.plan === "PRO" ? "∞" : usage.used}
                  {usage.plan !== "PRO" && (
                    <span className="mb-[3px] text-xs font-semibold text-text-secondary">
                      / {usage.limit}
                    </span>
                  )}
                </div>
                
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      (usage.limit && usage.percentUsed >= 90) ? "bg-destructive" : (usage.limit && usage.percentUsed >= 75) ? "bg-warning" : usage.plan === "PRO" ? "bg-emerald-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, usage.percentUsed)}%` }}
                  />
                </div>
              </div>
              
              <p className="relative z-10 mt-3.5 text-[11px] leading-relaxed text-text-secondary">
                {usage.plan === "PRO"
                  ? "Your Pro plan includes unlimited AI analyses everywhere in TraceForge."
                  : `${usage.remaining} analyses left this month. Upgrade to Pro for unlimited usage.`}
              </p>
            </div>
          )}
        </div>
      ) : null}

      <div className="relative mt-5" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className={`flex w-full items-center gap-3 rounded-2xl text-left transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50 ${
            collapsed 
              ? "border border-transparent bg-transparent p-2 shadow-none justify-center group-hover/nav:border-border group-hover/nav:bg-card group-hover/nav:px-3 group-hover/nav:py-3 group-hover/nav:shadow-sm group-hover/nav:justify-start" 
              : "border border-border bg-card px-3 py-3 shadow-sm"
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
          <ChevronDown
            className={`h-[18px] w-[18px] shrink-0 text-text-secondary transition-transform ${
              profileOpen ? "rotate-180" : ""
            } ${collapsed ? "hidden tf-reveal-block" : "block"}`}
            strokeWidth={2}
          />
        </button>

        {profileOpen && (
          <div
            className={`absolute bottom-[calc(100%+0.75rem)] z-50 w-64 rounded-3xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur transition-all duration-200 ${
              collapsed ? "left-full ml-3 group-hover/nav:left-0 group-hover/nav:right-0 group-hover/nav:ml-0" : "left-0 right-0"
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
                <UserCircle className="h-[18px] w-[18px] text-text-secondary" strokeWidth={2} />
                Account Details
              </button>

              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-3 text-sm font-semibold text-text-primary transition hover:border-[hsl(var(--destructive-border))] hover:bg-[hsl(var(--destructive-soft))] hover:text-[hsl(var(--destructive))]"
                onClick={handleSignOut}
              >
                <LogOut className="h-[18px] w-[18px] text-text-secondary transition group-hover:text-[hsl(var(--destructive))]" strokeWidth={2} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
