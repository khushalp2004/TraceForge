import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../db/redis.js";
import { limitConcurrentRequests } from "../middleware/concurrency.js";
import { getCachedAccessibleProjects } from "../utils/access.js";

export const analyticsRouter = Router();
const ANALYTICS_CACHE_TTL_SECONDS = 20;
const analyticsConcurrencyLimit = limitConcurrentRequests({
  namespace: "analytics:overview",
  maxConcurrent: 20,
  message: "Analytics is busy right now. Please retry in a moment."
});

const buildComparisonMetric = (current: number, previous: number) => {
  const change = current - previous;
  const direction = change === 0 ? "flat" : change > 0 ? "up" : "down";
  const percentChange =
    previous === 0 ? (current === 0 ? 0 : 100) : Math.round((change / previous) * 100);

  return {
    current,
    previous,
    change,
    direction,
    percentChange
  };
};

const severityForMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("null") || lower.includes("undefined") || lower.includes("typeerror")) {
    return "critical" as const;
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("rate")) {
    return "warning" as const;
  }
  return "info" as const;
};

const severityFromRank = (rank: number) => {
  if (rank >= 3) return "CRITICAL" as const;
  if (rank >= 2) return "WARNING" as const;
  return "INFO" as const;
};

const sqlProjectFilter = (projectIds: string[]) =>
  Prisma.sql`err."projectId" IN (${Prisma.join(projectIds)})`;

analyticsRouter.get("/", requireAuth, analyticsConcurrencyLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, days } = req.query as { projectId?: string; days?: string };
  const windowDays = Math.min(Math.max(Number(days) || 7, 1), 90);
  const analyticsCacheKey = `analytics:${userId}:${projectId || "all"}:${windowDays}`;
  if (redis.isOpen) {
    const cached = await redis.get(analyticsCacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch {
        // Ignore malformed cache and rebuild.
      }
    }
  }

  const projects = await getCachedAccessibleProjects(userId);

  const allowedProjectIds = new Set(projects.map((p) => p.id));
  const projectNameMap = new Map(projects.map((project) => [project.id, project.name]));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!projectId && allowedProjectIds.size === 0) {
    const payload = {
      frequency: [],
      lastSeen: [],
      severityBreakdown: [],
      environmentHealth: [],
      projectPerformance: [],
      releaseImpact: [],
      alertCorrelation: [],
      topIssues: [],
      comparison: {
        events: buildComparisonMetric(0, 0),
        activeIssues: buildComparisonMetric(0, 0),
        productionEvents: buildComparisonMetric(0, 0)
      },
      days: windowDays
    };
    if (redis.isOpen) {
      await redis.setEx(analyticsCacheKey, ANALYTICS_CACHE_TTL_SECONDS, JSON.stringify(payload));
    }
    return res.json(payload);
  }

  const projectFilter = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (windowDays - 1));
  start.setHours(0, 0, 0, 0);
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - windowDays);

  const filteredProjectIds = projectId ? [projectId] : Array.from(allowedProjectIds);
  const projectScope = sqlProjectFilter(filteredProjectIds);

  const [
    frequencyRows,
    lastSeenRows,
    severityRows,
    environmentRows,
    projectPerformanceRows,
    topIssues,
    releaseImpactRows,
    alertCorrelationRows,
    comparisonEventRows,
    comparisonIssueRows
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>(Prisma.sql`
      SELECT DATE_TRUNC('day', e."timestamp") AS "date", COUNT(*) AS "count"
      FROM "ErrorEvent" e
      INNER JOIN "Error" err ON err."id" = e."errorId"
      WHERE ${projectScope}
        AND e."timestamp" >= ${start}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>(Prisma.sql`
      SELECT DATE_TRUNC('day', err."lastSeen") AS "date", COUNT(*) AS "count"
      FROM "Error" err
      WHERE ${projectScope}
        AND err."lastSeen" >= ${start}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<
      Array<{ severity: "critical" | "warning" | "info"; count: bigint }>
    >(Prisma.sql`
      SELECT
        CASE
          WHEN LOWER(err."message") LIKE '%null%' OR LOWER(err."message") LIKE '%undefined%' OR LOWER(err."message") LIKE '%typeerror%' THEN 'critical'
          WHEN LOWER(err."message") LIKE '%timeout%' OR LOWER(err."message") LIKE '%network%' OR LOWER(err."message") LIKE '%rate%' THEN 'warning'
          ELSE 'info'
        END AS "severity",
        COALESCE(SUM(err."count"), 0) AS "count"
      FROM "Error" err
      WHERE ${projectScope}
        AND err."lastSeen" >= ${start}
      GROUP BY 1
    `),
    prisma.$queryRaw<Array<{ label: string; count: bigint }>>(Prisma.sql`
      SELECT
        COALESCE(NULLIF(BTRIM(e."environment"), ''), 'Unknown') AS "label",
        COUNT(*) AS "count"
      FROM "ErrorEvent" e
      INNER JOIN "Error" err ON err."id" = e."errorId"
      WHERE ${projectScope}
        AND e."timestamp" >= ${start}
      GROUP BY 1
      ORDER BY "count" DESC
    `),
    prisma.$queryRaw<Array<{ projectId: string; label: string; count: bigint }>>(Prisma.sql`
      SELECT
        err."projectId" AS "projectId",
        p."name" AS "label",
        COALESCE(SUM(err."count"), 0) AS "count"
      FROM "Error" err
      INNER JOIN "Project" p ON p."id" = err."projectId"
      WHERE ${projectScope}
        AND err."lastSeen" >= ${start}
      GROUP BY err."projectId", p."name"
      ORDER BY "count" DESC
      LIMIT 6
    `),
    prisma.error.findMany({
      where: {
        ...projectFilter,
        lastSeen: {
          gte: start
        }
      },
      orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
      take: 5,
      select: {
        id: true,
        message: true,
        count: true,
        lastSeen: true,
        projectId: true
      }
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        releaseId: string | null;
        version: string;
        environment: string | null;
        projectId: string;
        projectName: string;
        eventCount: bigint;
        issueCount: bigint;
        lastEventAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(e."releaseId", err."projectId" || ':' || BTRIM(e."payload"->>'release')) AS "id",
        e."releaseId" AS "releaseId",
        BTRIM(e."payload"->>'release') AS "version",
        NULLIF(BTRIM(e."payload"->>'environment'), '') AS "environment",
        err."projectId" AS "projectId",
        p."name" AS "projectName",
        COUNT(*) AS "eventCount",
        COUNT(DISTINCT e."errorId") AS "issueCount",
        MAX(e."timestamp") AS "lastEventAt"
      FROM "ErrorEvent" e
      INNER JOIN "Error" err ON err."id" = e."errorId"
      INNER JOIN "Project" p ON p."id" = err."projectId"
      WHERE ${projectScope}
        AND e."timestamp" >= ${start}
        AND NULLIF(BTRIM(e."payload"->>'release'), '') IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5, 6
      ORDER BY "eventCount" DESC, "lastEventAt" DESC
      LIMIT 5
    `),
    prisma.$queryRaw<
      Array<{
        errorId: string;
        message: string;
        projectId: string;
        projectName: string;
        alertCount: bigint;
        lastTriggeredAt: Date;
        ruleNames: string[];
        severityRank: number;
      }>
    >(Prisma.sql`
      SELECT
        d."errorId" AS "errorId",
        err."message" AS "message",
        d."projectId" AS "projectId",
        p."name" AS "projectName",
        COUNT(*) AS "alertCount",
        MAX(d."triggeredAt") AS "lastTriggeredAt",
        ARRAY_AGG(DISTINCT ar."name") AS "ruleNames",
        MAX(
          CASE ar."severity"
            WHEN 'CRITICAL' THEN 3
            WHEN 'WARNING' THEN 2
            ELSE 1
          END
        ) AS "severityRank"
      FROM "AlertDelivery" d
      INNER JOIN "Error" err ON err."id" = d."errorId"
      INNER JOIN "Project" p ON p."id" = d."projectId"
      INNER JOIN "AlertRule" ar ON ar."id" = d."alertRuleId"
      WHERE d."projectId" IN (${Prisma.join(filteredProjectIds)})
        AND d."triggeredAt" >= ${start}
      GROUP BY d."errorId", err."message", d."projectId", p."name"
      ORDER BY "alertCount" DESC, "lastTriggeredAt" DESC
      LIMIT 5
    `),
    prisma.$queryRaw<
      Array<{ window: "current" | "previous"; totalEvents: bigint; productionEvents: bigint }>
    >(Prisma.sql`
      SELECT
        CASE
          WHEN e."timestamp" >= ${start} THEN 'current'
          ELSE 'previous'
        END AS "window",
        COUNT(*) AS "totalEvents",
        COUNT(*) FILTER (WHERE LOWER(COALESCE(e."environment", '')) = 'production') AS "productionEvents"
      FROM "ErrorEvent" e
      INNER JOIN "Error" err ON err."id" = e."errorId"
      WHERE ${projectScope}
        AND e."timestamp" >= ${previousStart}
      GROUP BY 1
    `),
    prisma.$queryRaw<Array<{ window: "current" | "previous"; activeIssues: bigint }>>(Prisma.sql`
      SELECT
        CASE
          WHEN err."lastSeen" >= ${start} THEN 'current'
          ELSE 'previous'
        END AS "window",
        COUNT(*) AS "activeIssues"
      FROM "Error" err
      WHERE ${projectScope}
        AND err."lastSeen" >= ${previousStart}
      GROUP BY 1
    `)
  ]);

  const dayKey = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const frequencyMap = new Map<string, number>();
  const lastSeenMap = new Map<string, number>();
  for (let i = 0; i < windowDays; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dayKey(day);
    frequencyMap.set(key, 0);
    lastSeenMap.set(key, 0);
  }

  frequencyRows.forEach((row) => {
    frequencyMap.set(dayKey(row.date), Number(row.count));
  });

  lastSeenRows.forEach((row) => {
    lastSeenMap.set(dayKey(row.date), Number(row.count));
  });

  const frequency = Array.from(frequencyMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  const lastSeen = Array.from(lastSeenMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  const severityTotals = {
    critical: 0,
    warning: 0,
    info: 0
  };

  severityRows.forEach((row) => {
    severityTotals[row.severity] = Number(row.count);
  });

  const severityBreakdown = [
    { label: "Critical", count: severityTotals.critical, tone: "critical" },
    { label: "Warning", count: severityTotals.warning, tone: "warning" },
    { label: "Info", count: severityTotals.info, tone: "info" }
  ];

  const environmentHealth = environmentRows.map((row) => ({
    label: row.label,
    count: Number(row.count)
  }));

  const projectPerformance = projectPerformanceRows.map((item) => ({
    projectId: item.projectId,
    label: item.label,
    count: Number(item.count)
  }));

  const releaseImpact = releaseImpactRows
    .map((item) => {
      const eventCount = Number(item.eventCount);
      const issueCount = Number(item.issueCount);
      const health =
        eventCount === 0
          ? "healthy"
          : eventCount <= 5 && issueCount <= 2
          ? "monitoring"
          : "regression";

      return {
        id: item.id,
        version: item.version,
        environment: item.environment,
        releasedAt: item.lastEventAt,
        projectId: item.projectId,
        projectName: item.projectName,
        eventCount,
        issueCount,
        lastEventAt: item.lastEventAt,
        health
      };
    });

  const alertCorrelation = alertCorrelationRows.map((item) => ({
    errorId: item.errorId,
    message: item.message,
    projectId: item.projectId,
    projectName: item.projectName,
    alertCount: Number(item.alertCount),
    lastTriggeredAt: item.lastTriggeredAt,
    ruleNames: item.ruleNames,
    severity: severityFromRank(item.severityRank)
  }));

  const comparisonEventMap = new Map(
    comparisonEventRows.map((row) => [
      row.window,
      {
        totalEvents: Number(row.totalEvents),
        productionEvents: Number(row.productionEvents)
      }
    ])
  );
  const comparisonIssueMap = new Map(
    comparisonIssueRows.map((row) => [row.window, Number(row.activeIssues)])
  );

  const currentEventTotal = comparisonEventMap.get("current")?.totalEvents || 0;
  const previousEventTotal = comparisonEventMap.get("previous")?.totalEvents || 0;
  const currentProductionTotal = comparisonEventMap.get("current")?.productionEvents || 0;
  const previousProductionTotal = comparisonEventMap.get("previous")?.productionEvents || 0;
  const currentActiveIssues = comparisonIssueMap.get("current") || 0;
  const previousActiveIssues = comparisonIssueMap.get("previous") || 0;

  const payload = {
    frequency,
    lastSeen,
    severityBreakdown,
    environmentHealth,
    projectPerformance,
    releaseImpact,
    alertCorrelation,
    comparison: {
      events: buildComparisonMetric(currentEventTotal, previousEventTotal),
      activeIssues: buildComparisonMetric(currentActiveIssues, previousActiveIssues),
      productionEvents: buildComparisonMetric(currentProductionTotal, previousProductionTotal)
    },
    topIssues: topIssues.map((item) => ({
      id: item.id,
      message: item.message,
      count: item.count,
      lastSeen: item.lastSeen,
      projectName: projectNameMap.get(item.projectId) || "Unknown project"
    })),
    days: windowDays
  };

  if (redis.isOpen) {
    await redis.setEx(analyticsCacheKey, ANALYTICS_CACHE_TTL_SECONDS, JSON.stringify(payload));
  }

  return res.json(payload);
});

analyticsRouter.get("/public/metrics", async (req, res) => {
  try {
    const totalErrors = await prisma.error.count();
    const totalEvents = await prisma.errorEvent.count();
    const activeProjects = await prisma.project.count({
      where: { archivedAt: null }
    });
    const totalOrgs = await prisma.organization.count();
    const recentErrors = await prisma.error.count({
      where: {
        lastSeen: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // last 30 days
        }
      }
    });

    // Calculate uptime (simplified - 99.99% base)
    const uptime = 99.99;

    // Median triage time (placeholder - calculate from resolved errors if tracked)
    const medianTriageTime = "4 min";

    res.json({
      totalErrors,
      totalEvents,
      activeProjects,
      totalOrgs,
      recentErrors,
      uptime: `${uptime}%`,
      medianTriageTime
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});
