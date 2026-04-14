"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SparkAreaChart } from "../components/SparkAreaChart";
import { DashboardPagination } from "../components/DashboardPagination";
import { useLayout } from "../../../context/LayoutContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const insightsPrefsKey = "traceforge_insights_prefs_v1";
const INSIGHTS_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

type Project = {
  id: string;
  name: string;
};

type AnalyticsPoint = {
  date: string;
  count: number;
};

type BreakdownItem = {
  label: string;
  count: number;
};

type SeverityBreakdownItem = BreakdownItem & {
  tone: "critical" | "warning" | "info";
};

type ProjectPerformanceItem = BreakdownItem & {
  projectId: string;
};

type TopIssue = {
  id: string;
  message: string;
  count: number;
  lastSeen: string;
  projectName: string;
};

type AlertCorrelationItem = {
  errorId: string;
  message: string;
  projectId: string;
  projectName: string;
  alertCount: number;
  lastTriggeredAt: string;
  ruleNames: string[];
  severity: "INFO" | "WARNING" | "CRITICAL";
};

type ReleaseImpactItem = {
  id: string;
  version: string;
  environment: string | null;
  releasedAt: string;
  projectId: string;
  projectName: string;
  eventCount: number;
  issueCount: number;
  lastEventAt: string;
  health: "healthy" | "monitoring" | "regression";
};

type ComparisonMetric = {
  current: number;
  previous: number;
  change: number;
  direction: "up" | "down" | "flat";
  percentChange: number;
};

type InsightsComparison = {
  events: ComparisonMetric;
  activeIssues: ComparisonMetric;
  productionEvents: ComparisonMetric;
};

type Toast = {
  message: string;
  tone: "success" | "error";
};

function useInsightsPagination(totalItems: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return {
    page,
    pageSize,
    totalPages,
    showPagination: totalItems > 5,
    setPage,
    setPageSize
  };
}

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-border bg-card/90 p-6 ${className}`}>
      <div className="h-4 w-36 rounded-full bg-secondary/90" />
      <div className="mt-2 h-3 w-52 rounded-full bg-secondary/70" />
      <div className="mt-6 h-56 rounded-2xl bg-secondary/70" />
    </div>
  );
}

function InsightLineCard({
  title,
  description,
  data,
  tone = "primary",
  ctaHref,
  ctaLabel,
  unitLabel = "events",
  chartVariant = "area"
}: {
  title: string;
  description: string;
  data: AnalyticsPoint[];
  tone?: "primary" | "muted";
  ctaHref?: string;
  ctaLabel?: string;
  unitLabel?: string;
  chartVariant?: "area" | "bar";
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const peak = Math.max(0, ...data.map((item) => item.count));

  if (!data.some((item) => item.count > 0)) {
    return <EmptyChartCard title={title} description={description} />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
            {total} events
          </span>
          {ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
            >
              {ctaLabel || "Open"}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-secondary/20 p-5">
        <SparkAreaChart
          data={data}
          tone={tone}
          height={224}
          unitLabel={unitLabel}
          variant={chartVariant}
          showXAxis={false}
        />
        <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
          <span>{data[0]?.date.slice(5) || ""}</span>
          <span>Peak {peak}</span>
          <span>{data[data.length - 1]?.date.slice(5) || ""}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyChartCard({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          No data
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/30 p-5">
        <div className="flex h-56 items-center justify-center rounded-2xl bg-card/70">
          <div className="text-center">
            <p className="text-sm font-semibold text-text-primary">No data available yet</p>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">
              This chart will populate once your projects start sending enough events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard<T extends BreakdownItem>({
  title,
  description,
  items,
  getItemHref,
  itemActionLabel = "Open"
}: {
  title: string;
  description: string;
  items: T[];
  getItemHref?: (item: T) => string | null;
  itemActionLabel?: string;
}) {
  const topCount = Math.max(1, ...items.map((item) => item.count));

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <span className="w-fit whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          {items.length} groups
        </span>
      </div>

      {items.length ? (
        <div className="mt-6 space-y-3">
          {items.map((item) => {
            const href = getItemHref?.(item) || "";
            const content = (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold text-text-primary sm:truncate">
                    {item.label}
                  </p>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-sm font-semibold text-text-primary">{item.count}</span>
                    {href && (
                      <span className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                        {itemActionLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-card/70">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${Math.max(12, (item.count / topCount) * 100)}%` }}
                  />
                </div>
              </>
            );

            return href ? (
              <Link
                key={item.label}
                href={href}
                className="block rounded-2xl border border-border bg-secondary/20 px-4 py-3 transition hover:border-primary/25 hover:bg-secondary/25"
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-5 text-sm text-text-secondary">
          No grouped data yet for this scope.
        </div>
      )}
    </div>
  );
}

function SeverityInsightsCard({
  items,
  getSeverityHref
}: {
  items: SeverityBreakdownItem[];
  getSeverityHref?: (tone: SeverityBreakdownItem["tone"]) => string | null;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const toneClasses: Record<SeverityBreakdownItem["tone"], string> = {
    critical: "tf-danger-tag",
    warning: "tf-warning-tag",
    info: "tf-muted-tag"
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Severity mix</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Error volume split by severity across the selected scope.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          {total} total hits
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const href = getSeverityHref?.(item.tone) || "";

          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[item.tone]}`}>
                  {item.label}
                </span>
                <span className="text-xs font-semibold text-text-secondary">{share}%</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-text-primary">{item.count}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {item.tone === "critical"
                  ? "Highest-priority failures"
                  : item.tone === "warning"
                  ? "Operational instability signals"
                  : "Lower-severity noise"}
              </p>
              {href && (
                <span className="mt-3 inline-flex whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  Drill down
                </span>
              )}
            </>
          );

          return href ? (
            <Link
              key={item.label}
              href={href}
              className="block rounded-2xl border border-border bg-secondary/20 px-4 py-4 transition hover:border-primary/25 hover:bg-secondary/25"
            >
              {content}
            </Link>
          ) : (
            <div key={item.label} className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopIssuesCard({ items }: { items: TopIssue[] }) {
  const { page, pageSize, totalPages, showPagination, setPage, setPageSize } =
    useInsightsPagination(items.length);
  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">Top recurring issues</h2>
          <p className="mt-1 text-sm text-text-secondary">
            The noisiest issues across your tracked projects.
          </p>
        </div>
        <span className="w-fit whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
          {items.length} issues
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          paginatedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-secondary/25 px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-text-primary sm:truncate">
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.projectName} · Last seen {new Date(item.lastSeen).toLocaleString()}
                  </p>
                </div>
                <span className="w-fit shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  {item.count}
                </span>
              </div>
              <div className="mt-3">
                <Link
                  href={`/dashboard/errors/${item.id}`}
                  className="inline-flex w-full justify-center whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary sm:w-auto"
                >
                  Open issue
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div
            className="rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-4"
          >
            <p className="text-sm font-semibold text-text-primary">No issue data yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Once events arrive, recurring issue patterns will appear here.
            </p>
          </div>
        )}
      </div>

      {showPagination && (
        <DashboardPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={INSIGHTS_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
        />
      )}
    </div>
  );
}

function ReleaseImpactCard({
  items,
  getReleaseHref
}: {
  items: ReleaseImpactItem[];
  getReleaseHref?: (item: ReleaseImpactItem) => string | null;
}) {
  const { page, pageSize, totalPages, showPagination, setPage, setPageSize } =
    useInsightsPagination(items.length);
  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );
  const healthTone: Record<ReleaseImpactItem["health"], string> = {
    healthy: "tf-success-tag",
    monitoring: "tf-warning-tag",
    regression: "tf-danger-tag"
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Release impact</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Releases with the most linked error activity in the current window.
          </p>
        </div>
        <Link
          href="/dashboard/releases"
          className="inline-flex whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
        >
          Open releases
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          paginatedItems.map((item) => (
            <Link
              key={item.id}
              href={getReleaseHref?.(item) || "/dashboard/releases"}
              className="block rounded-2xl border border-border bg-secondary/20 px-4 py-4 transition hover:border-primary/25 hover:bg-secondary/25"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{item.version}</p>
                    <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${healthTone[item.health]}`}>
                      {item.health}
                    </span>
                    <span className="whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                      Drill down
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.projectName}
                    {item.environment ? ` · ${item.environment}` : ""}
                    {" · "}Released {new Date(item.releasedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right text-xs text-text-secondary">
                  <p className="font-semibold text-text-primary">{item.eventCount} events</p>
                  <p>{item.issueCount} issues</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Last linked event {new Date(item.lastEventAt).toLocaleString()}
              </p>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-4">
            <p className="text-sm font-semibold text-text-primary">No release-linked activity yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Send events with a release value to understand which releases are driving issues.
            </p>
          </div>
        )}
      </div>

      {showPagination && (
        <DashboardPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={INSIGHTS_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
        />
      )}
    </div>
  );
}

function AlertCorrelationCard({
  items,
  getAlertsHref
}: {
  items: AlertCorrelationItem[];
  getAlertsHref?: (item: AlertCorrelationItem) => string | null;
}) {
  const { page, pageSize, totalPages, showPagination, setPage, setPageSize } =
    useInsightsPagination(items.length);
  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );
  const severityTone: Record<AlertCorrelationItem["severity"], string> = {
    CRITICAL: "tf-danger-tag",
    WARNING: "tf-warning-tag",
    INFO: "tf-muted-tag"
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Alert correlation</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Issues that are most often turning into actual alerts.
          </p>
        </div>
        <Link
          href="/dashboard/alerts"
          className="inline-flex whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
        >
          Open alerts
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          paginatedItems.map((item) => (
            <div key={item.errorId} className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">{item.message}</p>
                    <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${severityTone[item.severity]}`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.projectName} · Last alerted {new Date(item.lastTriggeredAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    Rules: {item.ruleNames.join(", ")}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl border border-border bg-card/80 px-3 py-2 text-center sm:min-w-[96px]">
                  <p className="text-xl font-semibold text-text-primary">{item.alertCount}</p>
                  <p className="text-xs text-text-secondary">alert triggers</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/errors/${item.errorId}`}
                  className="inline-flex whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                >
                  Open issue
                </Link>
                <Link
                  href={getAlertsHref?.(item) || "/dashboard/alerts"}
                  className="inline-flex whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                >
                  Open alerts
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-4">
            <p className="text-sm font-semibold text-text-primary">No alert-linked issues yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Once alert rules start firing, correlated issues will show up here.
            </p>
          </div>
        )}
      </div>

      {showPagination && (
        <DashboardPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={INSIGHTS_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
        />
      )}
    </div>
  );
}

function formatDelta(metric: ComparisonMetric) {
  if (metric.direction === "flat") {
    return "No change";
  }

  const prefix = metric.direction === "up" ? "+" : "";
  return `${prefix}${metric.percentChange}%`;
}

function ComparisonCard({
  title,
  description,
  metric,
  windowLabel,
  href,
  hrefLabel = "Open"
}: {
  title: string;
  description: string;
  metric: ComparisonMetric;
  windowLabel: string;
  href?: string;
  hrefLabel?: string;
}) {
  const deltaTone =
    metric.direction === "up"
      ? "tf-warning-tag"
      : metric.direction === "down"
      ? "tf-success-tag"
      : "tf-muted-tag";

  return (
    <div className="rounded-2xl border border-border bg-card/90 px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            {title}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${deltaTone}`}>
            {formatDelta(metric)}
          </span>
          {href && (
            <Link
              href={href}
              className="inline-flex whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
            >
              {hrefLabel}
            </Link>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-text-primary">{metric.current}</p>
          <p className="mt-1 text-xs text-text-secondary">
            vs {metric.previous} in previous {windowLabel}
          </p>
        </div>
        <p className="text-right text-xs font-medium text-text-secondary">
          {metric.direction === "flat"
            ? "Holding steady"
            : metric.direction === "up"
            ? `${Math.abs(metric.change)} more than previous`
            : `${Math.abs(metric.change)} fewer than previous`}
        </p>
      </div>
    </div>
  );
}

function HighlightsCard({
  days,
  scopeLabel,
  projectId,
  comparison,
  severityBreakdown,
  environmentHealth,
  releaseImpact,
  alertCorrelation
}: {
  days: number;
  scopeLabel: string;
  projectId: string;
  comparison: InsightsComparison;
  severityBreakdown: SeverityBreakdownItem[];
  environmentHealth: BreakdownItem[];
  releaseImpact: ReleaseImpactItem[];
  alertCorrelation: AlertCorrelationItem[];
}) {
  const totalHits = severityBreakdown.reduce((sum, item) => sum + item.count, 0);
  const criticalHits = severityBreakdown.find((item) => item.tone === "critical")?.count ?? 0;
  const criticalShare = totalHits > 0 ? Math.round((criticalHits / totalHits) * 100) : 0;
  const topEnvironment = environmentHealth[0];
  const topRelease = releaseImpact[0];
  const topAlertIssue = alertCorrelation[0];

  const metricSentence = (label: string, metric: ComparisonMetric) => {
    if (metric.direction === "flat") {
      return `${label} is flat vs previous ${days} days (${metric.current} total).`;
    }

    const directionWord = metric.direction === "up" ? "up" : "down";
    const change = metric.direction === "up" ? `+${metric.percentChange}%` : `${metric.percentChange}%`;
    return `${label} is ${directionWord} ${change} vs previous ${days} days (${metric.current} total).`;
  };

  const scopedHref = (base: "/dashboard/issues" | "/dashboard/alerts" | "/dashboard/releases") => {
    if (!projectId) return base;
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    return `${base}?${params.toString()}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Highlights</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Actionable summary for <span className="font-semibold text-text-primary">{scopeLabel}</span> over the last{" "}
            {days} days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={scopedHref("/dashboard/issues")}
            className="inline-flex whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
          >
            Open issues
          </Link>
          <Link
            href={scopedHref("/dashboard/alerts")}
            className="inline-flex whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
          >
            Open alerts
          </Link>
          <Link
            href={scopedHref("/dashboard/releases")}
            className="inline-flex whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
          >
            Open releases
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <p className="text-sm font-semibold text-text-primary">Trend</p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>{metricSentence("Event volume", comparison.events)}</li>
            <li>{metricSentence("Active issues", comparison.activeIssues)}</li>
            <li>{metricSentence("Production events", comparison.productionEvents)}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
          <p className="text-sm font-semibold text-text-primary">Drivers</p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>
              Critical severity: <span className="font-semibold text-text-primary">{criticalHits}</span> hits{" "}
              <span className="text-text-secondary">({criticalShare}%)</span>.
            </li>
            <li>
              Top environment:{" "}
              <span className="font-semibold text-text-primary">
                {topEnvironment ? `${topEnvironment.label} (${topEnvironment.count})` : "No data"}
              </span>
              .
            </li>
            <li>
              Top impacted release:{" "}
              <span className="font-semibold text-text-primary">
                {topRelease ? `${topRelease.version} (${topRelease.eventCount} events)` : "No release tags yet"}
              </span>
              .
            </li>
            <li className="flex flex-wrap items-center gap-2">
              Most alerted issue:{" "}
              <span className="font-semibold text-text-primary">
                {topAlertIssue ? `${topAlertIssue.alertCount} triggers` : "No alerts yet"}
              </span>
              {topAlertIssue && (
                <Link
                  href={`/dashboard/errors/${topAlertIssue.errorId}`}
                  className="inline-flex whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                >
                  Open
                </Link>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const prefsHydratedRef = useRef(false);
  const { layout } = useLayout();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout = isDesktop ? layout : "classic";
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [days, setDays] = useState(30);
  const [chartVariant, setChartVariant] = useState<"area" | "bar">("area");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [frequency, setFrequency] = useState<AnalyticsPoint[]>([]);
  const [lastSeen, setLastSeen] = useState<AnalyticsPoint[]>([]);
  const [severityBreakdown, setSeverityBreakdown] = useState<SeverityBreakdownItem[]>([]);
  const [environmentHealth, setEnvironmentHealth] = useState<BreakdownItem[]>([]);
  const [projectPerformance, setProjectPerformance] = useState<ProjectPerformanceItem[]>([]);
  const [releaseImpact, setReleaseImpact] = useState<ReleaseImpactItem[]>([]);
  const [alertCorrelation, setAlertCorrelation] = useState<AlertCorrelationItem[]>([]);
  const [topIssues, setTopIssues] = useState<TopIssue[]>([]);
  const [comparison, setComparison] = useState<InsightsComparison>({
    events: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 },
    activeIssues: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 },
    productionEvents: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 }
  });
  const loading = projectsLoading || insightsLoading;
  const isTopbarLayout = effectiveLayout === "topbar";
  const isCompactLayout = effectiveLayout === "compact";
  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(insightsPrefsKey);
      if (!raw) return;
      const prefs = JSON.parse(raw) as {
        projectId?: string;
        days?: number;
        chartVariant?: "area" | "bar";
      };

      if (typeof prefs.projectId === "string") setSelectedProjectId(prefs.projectId);
      if (prefs.days === 7 || prefs.days === 14 || prefs.days === 30) setDays(prefs.days);
      if (prefs.chartVariant === "area" || prefs.chartVariant === "bar") setChartVariant(prefs.chartVariant);
    } catch {
      // Ignore malformed prefs.
    } finally {
      prefsHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydratedRef.current) return;
    window.localStorage.setItem(
      insightsPrefsKey,
      JSON.stringify({
        projectId: selectedProjectId,
        days,
        chartVariant
      })
    );
  }, [selectedProjectId, days, chartVariant]);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setProjectsLoading(false);
      return;
    }

    const loadProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/projects`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load projects");
        }

        setProjects(data.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };

    void loadProjects();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setInsightsLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadInsights = async () => {
      try {
        setInsightsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedProjectId) {
          params.set("projectId", selectedProjectId);
        }
        params.set("days", String(days));

        const res = await fetch(`${API_URL}/analytics?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load insights");
        }

        if (controller.signal.aborted) {
          return;
        }

        setFrequency(data.frequency || []);
        setLastSeen(data.lastSeen || []);
        setSeverityBreakdown(data.severityBreakdown || []);
        setEnvironmentHealth(data.environmentHealth || []);
        setProjectPerformance(data.projectPerformance || []);
        setReleaseImpact(data.releaseImpact || []);
        setAlertCorrelation(data.alertCorrelation || []);
        setComparison(
          data.comparison || {
            events: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 },
            activeIssues: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 },
            productionEvents: { current: 0, previous: 0, change: 0, direction: "flat", percentChange: 0 }
          }
        );
        setTopIssues(data.topIssues || []);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load insights");
      } finally {
        if (!controller.signal.aborted) {
          setInsightsLoading(false);
        }
      }
    };

    void loadInsights();

    return () => controller.abort();
  }, [selectedProjectId, days]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const scopeLabel = selectedProject ? selectedProject.name : "All projects";
  const visibleProjectPerformance = useMemo(
    () =>
      selectedProjectId
        ? projectPerformance
        : projectPerformance.length
        ? projectPerformance
        : projects.map((project) => ({ projectId: project.id, label: project.name, count: 0 })),
    [projectPerformance, projects, selectedProjectId]
  );

  const buildIssuesHref = (options?: {
    projectId?: string;
    env?: string;
    severity?: "critical" | "warning" | "info";
    q?: string;
    sort?: "lastSeen" | "count";
    archivedOnly?: boolean;
  }) => {
    const params = new URLSearchParams();
    const project = options?.projectId ?? selectedProjectId;
    if (project) params.set("projectId", project);
    if (options?.env) params.set("env", options.env);
    if (options?.severity) params.set("severity", options.severity);
    if (options?.q) params.set("q", options.q);
    if (options?.sort) params.set("sort", options.sort);
    if (options?.archivedOnly) params.set("archivedOnly", "true");
    const query = params.toString();
    return `/dashboard/issues${query ? `?${query}` : ""}`;
  };

  const buildReleasesHref = (options?: {
    projectId?: string;
    environment?: string | null;
    releaseId?: string;
  }) => {
    const params = new URLSearchParams();
    const project = options?.projectId ?? selectedProjectId;
    if (project) params.set("projectId", project);
    if (options?.environment) params.set("environment", options.environment);
    if (options?.releaseId) params.set("releaseId", options.releaseId);
    const query = params.toString();
    return `/dashboard/releases${query ? `?${query}` : ""}`;
  };

  const buildAlertsHref = (options?: {
    q?: string;
    severity?: "INFO" | "WARNING" | "CRITICAL";
    env?: string;
    projectId?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.q) params.set("q", options.q);
    if (options?.severity) params.set("severity", options.severity);
    if (options?.env) params.set("env", options.env);
    if (options?.projectId) params.set("projectId", options.projectId);
    const query = params.toString();
    return `/dashboard/alerts${query ? `?${query}` : ""}`;
  };

  const normalizeEnv = (label: string) => {
    const env = label.trim().toLowerCase();
    if (env === "production" || env === "staging" || env === "development" || env === "browser") {
      return env;
    }
    return "";
  };

  const comparisonGrid = (
    <div
      className={`grid gap-4 ${
        isCompactLayout ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-3"
      }`}
    >
      <ComparisonCard
        title="Event Volume"
        description={`Events captured in the last ${days} days.`}
        metric={comparison.events}
        windowLabel={`${days} days`}
        href={buildIssuesHref()}
        hrefLabel="View issues"
      />
      <ComparisonCard
        title="Active Issues"
        description={`Issues seen during the last ${days} days.`}
        metric={comparison.activeIssues}
        windowLabel={`${days} days`}
        href={buildIssuesHref()}
        hrefLabel="View issues"
      />
      <ComparisonCard
        title="Production Impact"
        description="Production-scoped events compared to the previous period."
        metric={comparison.productionEvents}
        windowLabel={`${days} days`}
        href={buildIssuesHref({ env: "production" })}
        hrefLabel="View prod"
      />
    </div>
  );

  const highlightsCard = (
    <HighlightsCard
      days={days}
      scopeLabel={scopeLabel}
      projectId={selectedProjectId}
      comparison={comparison}
      severityBreakdown={severityBreakdown}
      environmentHealth={environmentHealth}
      releaseImpact={releaseImpact}
      alertCorrelation={alertCorrelation}
    />
  );

  const trendGrid = (
    <div className={`grid gap-4 ${isCompactLayout ? "xl:grid-cols-2" : "lg:grid-cols-2"}`}>
      <InsightLineCard
        title="Issue volume trend"
        description="Track how issue traffic changes over time across environments."
        data={frequency}
        tone="primary"
        ctaHref={buildIssuesHref()}
        ctaLabel="View issues"
        unitLabel="events"
        chartVariant={chartVariant}
      />
      <InsightLineCard
        title="Errors last seen"
        description={`Unique issues seen across the last ${days} days.`}
        data={lastSeen}
        tone="muted"
        ctaHref={buildIssuesHref({ sort: "lastSeen" })}
        ctaLabel="Open list"
        unitLabel="issues"
        chartVariant={chartVariant}
      />
    </div>
  );

  const severityCard = (
    <SeverityInsightsCard
      items={severityBreakdown}
      getSeverityHref={(tone) => buildIssuesHref({ severity: tone })}
    />
  );

  const projectPerformanceCard = (
    <BreakdownCard
      title="Project performance"
      description="See which projects are generating the most operational noise."
      items={visibleProjectPerformance}
      getItemHref={(item) => buildIssuesHref({ projectId: (item as ProjectPerformanceItem).projectId })}
      itemActionLabel="View"
    />
  );

  const releaseImpactCard = (
    <ReleaseImpactCard
      items={releaseImpact}
      getReleaseHref={(item) =>
        buildReleasesHref({
          projectId: item.projectId,
          environment: item.environment,
          releaseId: item.id
        })
      }
    />
  );

  const environmentTopIssuesGrid = (
    <div className={`grid gap-4 ${isCompactLayout ? "xl:grid-cols-2" : "xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]"}`}>
      <BreakdownCard
        title="Environment health"
        description="Compare production, staging, development, and browser traffic at a glance."
        items={environmentHealth}
        getItemHref={(item) => {
          const env = normalizeEnv(item.label);
          return env ? buildIssuesHref({ env }) : null;
        }}
        itemActionLabel="View"
      />
      <TopIssuesCard items={topIssues} />
    </div>
  );

  const alertCorrelationCard = (
    <AlertCorrelationCard
      items={alertCorrelation}
      getAlertsHref={(item) =>
        buildAlertsHref({
          q: item.ruleNames[0] || item.message,
          severity: item.severity,
          projectId: item.projectId
        })
      }
    />
  );

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tf-kicker">Insights</p>
            <h1 className="tf-title mt-3 text-3xl">Operational insights</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Start with overall trends across the account, then narrow to a single
              project when you want a focused view.
            </p>
          </div>
        </header>

        <section className="tf-filter-panel mt-6">
          <div className="tf-filter-grid sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,210px)_132px]">
            <label className="tf-filter-field">
              <span className="tf-filter-label">Scope</span>
              <select
                className="tf-select tf-filter-control w-full"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tf-filter-field">
              <span className="tf-filter-label">Window</span>
              <select
                className="tf-select tf-filter-control w-full"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </label>
            <div className="tf-filter-field">
              <span className="tf-filter-label">Chart</span>
              <div className="flex items-center rounded-full border border-border bg-card/90 p-1 text-xs font-semibold text-text-secondary shadow-sm">
                <button
                  type="button"
                  className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                    chartVariant === "area"
                      ? "bg-accent-soft text-text-primary"
                      : "hover:bg-secondary/70 hover:text-text-primary"
                  }`}
                  onClick={() => setChartVariant("area")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                    chartVariant === "bar"
                      ? "bg-accent-soft text-text-primary"
                      : "hover:bg-secondary/70 hover:text-text-primary"
                  }`}
                  onClick={() => setChartVariant("bar")}
                >
                  Bar
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="tf-filter-reset w-full"
                onClick={() => {
                  setSelectedProjectId("");
                  setDays(30);
                  setChartVariant("area");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {!loading && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
              Viewing: {scopeLabel}
            </span>
            <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-text-secondary">
              {selectedProject ? "Project-specific view" : "Overall account view"}
            </span>
          </div>
        )}

        {loading ? (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <ChartSkeleton />
              <ChartSkeleton />
            </section>

            <section className="mt-6">
              <ChartSkeleton />
            </section>
          </>
        ) : isTopbarLayout ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] xl:items-start">
            <div className="space-y-6">
              {comparisonGrid}
              {trendGrid}
              {environmentTopIssuesGrid}
              {alertCorrelationCard}
            </div>
            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              {highlightsCard}
              {severityCard}
              {projectPerformanceCard}
              {releaseImpactCard}
            </div>
          </section>
        ) : isCompactLayout ? (
          <>
            <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-start">
              <div className="space-y-6">{comparisonGrid}</div>
              <div className="lg:sticky lg:top-24 lg:self-start">{highlightsCard}</div>
            </section>
            <section className="mt-6">{severityCard}</section>
            <section className="mt-6">{trendGrid}</section>
            <section className="mt-6 grid gap-4 xl:grid-cols-2">
              {projectPerformanceCard}
              {releaseImpactCard}
            </section>
            <section className="mt-6">{environmentTopIssuesGrid}</section>
            <section className="mt-6">{alertCorrelationCard}</section>
          </>
        ) : (
          <>
            <section className="mt-6">{comparisonGrid}</section>
            <section className="mt-6">{highlightsCard}</section>
            <section className="mt-6">{trendGrid}</section>
            <section className="mt-6">{severityCard}</section>
            <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              {projectPerformanceCard}
              {releaseImpactCard}
            </section>
            <section className="mt-6">{environmentTopIssuesGrid}</section>
            <section className="mt-6">{alertCorrelationCard}</section>
          </>
        )}
      </div>
      {toast && (
        <div
          className={`tf-dashboard-toast ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
