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
const NOTIFICATIONS_URL = `${API_URL}/notifications/stream`;
const PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/issues",
  "/dashboard/projects",
  "/dashboard/releases",
  "/dashboard/insights",
  "/dashboard/alerts",
  "/dashboard/orgs",
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

    const stream = new EventSource(`${NOTIFICATIONS_URL}?token=${encodeURIComponent(token)}`);

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

  if (!isReady || !token) {
    return (
      <div className="flex min-h-screen overflow-x-hidden bg-background">
        {effectiveLayout === "topbar" ? null : (
          <div className="hidden w-64 border-r border-border bg-card/80 p-4 lg:block">
            <div className="h-20 animate-pulse rounded-3xl bg-secondary/70" />
            <div className="mt-6 space-y-3">
              <div className="h-10 animate-pulse rounded-2xl bg-secondary/70" />
              <div className="h-10 animate-pulse rounded-2xl bg-secondary/70" />
              <div className="h-10 animate-pulse rounded-2xl bg-secondary/70" />
            </div>
          </div>
        )}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {effectiveLayout === "topbar" ? (
            <div className="hidden border-b border-border bg-background px-4 py-4 lg:block">
              <div className="h-8 animate-pulse rounded-2xl bg-secondary/70" />
            </div>
          ) : (
            <div className="border-b border-border bg-background px-4 py-4 lg:hidden">
              <div className="h-8 animate-pulse rounded-2xl bg-secondary/70" />
            </div>
          )}
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="h-10 animate-pulse rounded-3xl bg-secondary/70" />
              <div className="h-40 animate-pulse rounded-3xl bg-secondary/70" />
              <div className="h-40 animate-pulse rounded-3xl bg-secondary/70" />
            </div>
          </main>
        </div>
      </div>
    );
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
              className={`pointer-events-auto rounded-3xl border bg-card/95 p-4 shadow-xl backdrop-blur ${
                toast.tone === "error"
                  ? "tf-danger-surface"
                  : toast.tone === "warning"
                  ? "border-amber-200"
                  : "border-emerald-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openDashboardNotifications(toast.href, toast.id)}
                >
                  <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{toast.message}</p>
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
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
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    toast.tone === "error"
                      ? "tf-danger-button"
                      : "border-border text-text-secondary hover:bg-secondary/70 hover:text-text-primary"
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

export default function DashboardShell(props: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="tf-page tf-dashboard-page" />}>
      <DashboardShellInner {...props} />
    </Suspense>
  );
}
