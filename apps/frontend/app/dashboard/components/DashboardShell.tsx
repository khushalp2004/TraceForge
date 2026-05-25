"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useLayout } from "../../../context/LayoutContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import DashboardMobileNav from "./DashboardMobileNav";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopNav from "./DashboardTopNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || API_URL;
const NOTIFICATIONS_URL = `${REALTIME_URL}/notifications/stream`;
const PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/issues",
  "/dashboard/projects",
  "/dashboard/releases",
  "/dashboard/insights",
  "/dashboard/alerts",
  "/dashboard/orgs",
  "/dashboard/admin",
  "/dashboard/repo-analysis",
  "/dashboard/settings",
  "/dashboard/billing",
  "/dashboard/account/details",
  "/docs"
];

type RealtimeNotificationPayload = {
  type:
    | "connected"
    | "invite.received"
    | "join_request.received"
    | "alert.triggered"
    | "alert.created"
    | "alert.deleted";
  title?: string;
  message?: string;
  createdAt?: string;
};

type ShellToast = {
  id: string;
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  actionLabel: string;
  href: string;
};

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { token, isReady } = useAuth();
  const { layout } = useLayout();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout = isDesktop ? layout : "classic";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [notificationToasts, setNotificationToasts] = useState<ShellToast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!token) {
      const query = searchParams.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      router.replace(`/signin?next=${encodeURIComponent(next || "/dashboard")}`);
    }
  }, [isReady, token, pathname, searchParams, router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    PREFETCH_ROUTES.forEach((href) => {
      router.prefetch(href);
    });
  }, [router, token]);

  useEffect(() => {
    setCollapsed(effectiveLayout === "compact");
  }, [effectiveLayout]);

  const removeShellToast = (id: string) => {
    setNotificationToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const shellNotificationMeta = useMemo(
    () => ({
      buildToast(payload: RealtimeNotificationPayload): ShellToast | null {
        if (
          payload.type === "connected" ||
          payload.type === "alert.deleted" ||
          !payload.message ||
          !payload.createdAt
        ) {
          return null;
        }

        if (payload.type === "invite.received") {
          return {
            id: `invite:${payload.createdAt}:${payload.message}`,
            title: payload.title || "New invite",
            message: payload.message,
            tone: "success",
            actionLabel: "View invite",
            href: "/dashboard?notifications=open&focus=invites"
          };
        }

        if (payload.type === "join_request.received") {
          return {
            id: `request:${payload.createdAt}:${payload.message}`,
            title: payload.title || "New join request",
            message: payload.message,
            tone: "warning",
            actionLabel: "Review request",
            href: "/dashboard?notifications=open&focus=requests"
          };
        }

        return {
          id: `alert:${payload.createdAt}:${payload.message}`,
          title: payload.title || "Alert triggered",
          message: payload.message || "An alert was triggered.",
          tone: payload.type === "alert.triggered" ? "error" : "warning",
          actionLabel:
            payload.type === "alert.created"
              ? "View alert"
              : "Open issues",
          href: "/dashboard?notifications=open&focus=alerts"
        };
      }
    }),
    []
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const stream = new EventSource(NOTIFICATIONS_URL, {
      withCredentials: true
    });

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeNotificationPayload;
        const nextToast = shellNotificationMeta.buildToast(payload);

        if (!nextToast) {
          return;
        }

        setNotificationToasts((prev) => {
          const deduped = prev.filter((toast) => toast.id !== nextToast.id);
          return [nextToast, ...deduped].slice(0, 3);
        });

        window.setTimeout(() => {
          removeShellToast(nextToast.id);
        }, 7000);
      } catch {
        // Ignore malformed SSE events.
      }
    };

    return () => {
      stream.close();
    };
  }, [pathname, shellNotificationMeta, token]);

  const openDashboardNotifications = (href: string, id: string) => {
    removeShellToast(id);
    router.push(href);
  };

  if (!mounted || !isReady || !token) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      {effectiveLayout === "topbar" ? null : (
        <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden ${
          effectiveLayout === "topbar" ? "" : collapsed ? "lg:pl-[85px]" : "lg:pl-64"
        }`}
      >
        {effectiveLayout === "topbar" ? <DashboardTopNav /> : null}
        {effectiveLayout === "topbar" ? <div className="hidden h-[72px] lg:block" /> : null}
        <DashboardMobileNav />
        <div className="h-[73px] lg:hidden" />
        <main className="min-w-0 flex-1 overflow-x-hidden pb-24 lg:pb-0">{children}</main>
      </div>
      {!!notificationToasts.length && (
        <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 lg:bottom-4">
          {notificationToasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto animate-fade-up tf-glass-modal p-4"
              style={{ borderRadius: "1.25rem" }}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  toast.tone === "error"
                    ? "bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]"
                    : toast.tone === "warning"
                    ? "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]"
                    : "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]"
                }`}>
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    {toast.tone === "error" ? (
                      <><circle cx="8" cy="8" r="6" /><path d="M8 5v3" /><circle cx="8" cy="11" r="0.5" fill="currentColor" /></>
                    ) : toast.tone === "warning" ? (
                      <><path d="M8 2L1.5 13h13L8 2z" /><path d="M8 7v2.5" /><circle cx="8" cy="11" r="0.5" fill="currentColor" /></>
                    ) : (
                      <><circle cx="8" cy="8" r="6" /><path d="M5.5 8l1.75 1.75L10.5 6" /></>
                    )}
                  </svg>
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openDashboardNotifications(toast.href, toast.id)}
                >
                  <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">{toast.message}</p>
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                  onClick={() => removeShellToast(toast.id)}
                  aria-label="Dismiss notification"
                >
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
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
              <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
                <button
                  type="button"
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    toast.tone === "error"
                      ? "tf-danger-button"
                      : "border-border bg-secondary/50 text-text-secondary hover:bg-secondary hover:text-text-primary"
                  }`}
                  onClick={() => openDashboardNotifications(toast.href, toast.id)}
                >
                  {toast.actionLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      <div className="hidden w-64 border-r border-border bg-card/80 p-5 lg:block shadow-sm">
        <div className="tf-shimmer h-[4.5rem] rounded-2xl bg-secondary/50" />
        <div className="mt-5 space-y-2.5">
          <div className="tf-shimmer h-10 rounded-xl bg-secondary/40" />
          <div className="tf-shimmer h-10 rounded-xl bg-secondary/35" style={{ animationDelay: "200ms" }} />
          <div className="tf-shimmer h-10 rounded-xl bg-secondary/30" style={{ animationDelay: "400ms" }} />
          <div className="tf-shimmer h-10 rounded-xl bg-secondary/25" style={{ animationDelay: "600ms" }} />
          <div className="tf-shimmer h-10 rounded-xl bg-secondary/20" style={{ animationDelay: "800ms" }} />
        </div>
        <div className="mt-auto pt-6 space-y-3">
          <div className="tf-shimmer h-12 rounded-2xl bg-secondary/35" style={{ animationDelay: "1000ms" }} />
          <div className="tf-shimmer h-14 rounded-2xl bg-secondary/30" style={{ animationDelay: "1200ms" }} />
        </div>
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-background px-4 py-4 lg:hidden">
          <div className="tf-shimmer h-9 rounded-xl bg-secondary/40" />
        </div>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="tf-shimmer h-8 w-32 rounded-xl bg-secondary/40" />
              <div className="tf-shimmer h-6 w-20 rounded-full bg-secondary/25" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="tf-shimmer h-28 rounded-2xl bg-secondary/30" />
              <div className="tf-shimmer h-28 rounded-2xl bg-secondary/25" style={{ animationDelay: "150ms" }} />
              <div className="tf-shimmer h-28 rounded-2xl bg-secondary/20" style={{ animationDelay: "300ms" }} />
            </div>
            <div className="tf-shimmer h-64 rounded-2xl bg-secondary/25" style={{ animationDelay: "400ms" }} />
            <div className="tf-shimmer h-48 rounded-2xl bg-secondary/20" style={{ animationDelay: "500ms" }} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell(props: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShellInner {...props} />
    </Suspense>
  );
}
