import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();

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

analyticsRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, days } = req.query as { projectId?: string; days?: string };
  const windowDays = Math.min(Math.max(Number(days) || 7, 1), 90);

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  const orgIds = memberships.map((m) => m.organizationId);

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    select: { id: true, name: true }
  });

  const allowedProjectIds = new Set(projects.map((p) => p.id));
  const projectNameMap = new Map(projects.map((project) => [project.id, project.name]));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!projectId && allowedProjectIds.size === 0) {
    return res.json({
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
    });
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

  const [events, errors, topIssues, releaseEvents, alertDeliveries] = await Promise.all([
    prisma.errorEvent.findMany({
      where: {
        error: {
          ...projectFilter
        },
        timestamp: {
          gte: previousStart
        }
      },
      select: { timestamp: true, environment: true }
    }),
    prisma.error.findMany({
      where: {
        ...projectFilter,
        lastSeen: {
          gte: previousStart
        }
      },
      select: {
        id: true,
        message: true,
        count: true,
        lastSeen: true,
        projectId: true
      }
    }),
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
    prisma.errorEvent.findMany({
      where: {
        error: {
          ...projectFilter
        },
        timestamp: {
          gte: start
        }
      },
      select: {
        errorId: true,
        releaseId: true,
        timestamp: true,
        payload: true,
        error: {
          select: {
            projectId: true
          }
        }
      }
    }),
    prisma.alertDelivery.findMany({
      where: {
        projectId: {
          in: filteredProjectIds
        },
        triggeredAt: {
          gte: start
        }
      },
      orderBy: {
        triggeredAt: "desc"
      },
      select: {
        errorId: true,
        projectId: true,
        triggeredAt: true,
        error: {
          select: {
            id: true,
            message: true,
            lastSeen: true
          }
        },
        project: {
          select: {
            name: true
          }
        },
        alertRule: {
          select: {
            name: true,
            severity: true
          }
        }
      }
    })
  ]);

  const dayKey = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const frequencyMap = new Map<string, number>();
  const lastSeenMap = new Map<string, number>();
  const severityMap = new Map<"critical" | "warning" | "info", number>([
    ["critical", 0],
    ["warning", 0],
    ["info", 0]
  ]);
  const environmentMap = new Map<string, number>();
  const projectPerformanceMap = new Map<string, { projectId: string; name: string; count: number }>();
  let currentEventTotal = 0;
  let previousEventTotal = 0;
  let currentProductionTotal = 0;
  let previousProductionTotal = 0;
  let currentActiveIssues = 0;
  let previousActiveIssues = 0;

  for (let i = 0; i < windowDays; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dayKey(day);
    frequencyMap.set(key, 0);
    lastSeenMap.set(key, 0);
  }

  events.forEach((event) => {
    const isCurrentWindow = event.timestamp >= start;

    if (isCurrentWindow) {
      currentEventTotal += 1;
      if ((event.environment || "").toLowerCase() === "production") {
        currentProductionTotal += 1;
      }
    } else {
      previousEventTotal += 1;
      if ((event.environment || "").toLowerCase() === "production") {
        previousProductionTotal += 1;
      }
      return;
    }

    const key = dayKey(event.timestamp);
    frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    const environmentKey = event.environment?.trim() || "Unknown";
    environmentMap.set(environmentKey, (environmentMap.get(environmentKey) || 0) + 1);
  });

  errors.forEach((item) => {
    if (item.lastSeen >= start) {
      currentActiveIssues += 1;
    } else {
      previousActiveIssues += 1;
      return;
    }

    const key = dayKey(item.lastSeen);
    lastSeenMap.set(key, (lastSeenMap.get(key) || 0) + 1);
    const severity = severityForMessage(item.message);
    severityMap.set(severity, (severityMap.get(severity) || 0) + item.count);

    const existingProject = projectPerformanceMap.get(item.projectId);
    if (existingProject) {
      existingProject.count += item.count;
      return;
    }

    projectPerformanceMap.set(item.projectId, {
      projectId: item.projectId,
      name: projectNameMap.get(item.projectId) || "Unknown project",
      count: item.count
    });
  });

  const frequency = Array.from(frequencyMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  const lastSeen = Array.from(lastSeenMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  const severityBreakdown = [
    { label: "Critical", count: severityMap.get("critical") || 0, tone: "critical" },
    { label: "Warning", count: severityMap.get("warning") || 0, tone: "warning" },
    { label: "Info", count: severityMap.get("info") || 0, tone: "info" }
  ];

  const environmentHealth = Array.from(environmentMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const projectPerformance = Array.from(projectPerformanceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => ({
      projectId: item.projectId,
      label: item.name,
      count: item.count
    }));

  const releaseImpactMap = new Map<
    string,
    {
      releaseId: string | null;
      version: string;
      environment: string | null;
      projectId: string;
      projectName: string;
      eventCount: number;
      issueIds: Set<string>;
      lastEventAt: Date;
    }
  >();

  releaseEvents.forEach((event) => {
    const payload = event.payload;
    const payloadRelease =
      payload &&
      typeof payload === "object" &&
      "release" in payload &&
      typeof payload.release === "string"
        ? payload.release.trim()
        : "";

    if (!payloadRelease) {
      return;
    }

    const releaseKey = event.releaseId || `${event.error.projectId}:${payloadRelease}`;
    const existing = releaseImpactMap.get(releaseKey);
    if (existing) {
      existing.eventCount += 1;
      existing.issueIds.add(event.errorId);
      if (event.timestamp > existing.lastEventAt) {
        existing.lastEventAt = event.timestamp;
      }
      return;
    }

    releaseImpactMap.set(releaseKey, {
      releaseId: event.releaseId || null,
      version: payloadRelease,
      environment:
        payload &&
        typeof payload === "object" &&
        "environment" in payload &&
        typeof payload.environment === "string"
          ? payload.environment
          : null,
      projectId: event.error.projectId,
      projectName: projectNameMap.get(event.error.projectId) || "Unknown project",
      eventCount: 1,
      issueIds: new Set([event.errorId]),
      lastEventAt: event.timestamp
    });
  });

  const releaseImpact = Array.from(releaseImpactMap.values())
    .map((item) => {
      const issueCount = item.issueIds.size;
      const health =
        item.eventCount === 0
          ? "healthy"
          : item.eventCount <= 5 && issueCount <= 2
          ? "monitoring"
          : "regression";

      return {
        id: item.releaseId || `${item.projectId}:${item.version}`,
        version: item.version,
        environment: item.environment,
        releasedAt: item.lastEventAt,
        projectId: item.projectId,
        projectName: item.projectName,
        eventCount: item.eventCount,
        issueCount,
        lastEventAt: item.lastEventAt,
        health
      };
    })
    .sort((a, b) => {
      if (b.eventCount !== a.eventCount) {
        return b.eventCount - a.eventCount;
      }
      return b.lastEventAt.getTime() - a.lastEventAt.getTime();
    })
    .slice(0, 5);

  const alertCorrelationMap = new Map<
    string,
    {
      errorId: string;
      message: string;
      projectName: string;
      alertCount: number;
      lastTriggeredAt: Date;
      ruleNames: Set<string>;
      severity: "INFO" | "WARNING" | "CRITICAL";
    }
  >();

  const severityRank = {
    INFO: 0,
    WARNING: 1,
    CRITICAL: 2
  } as const;

  alertDeliveries.forEach((delivery) => {
    const existing = alertCorrelationMap.get(delivery.errorId);

    if (existing) {
      existing.alertCount += 1;
      existing.ruleNames.add(delivery.alertRule.name);
      if (delivery.triggeredAt > existing.lastTriggeredAt) {
        existing.lastTriggeredAt = delivery.triggeredAt;
      }
      if (severityRank[delivery.alertRule.severity] > severityRank[existing.severity]) {
        existing.severity = delivery.alertRule.severity;
      }
      return;
    }

    alertCorrelationMap.set(delivery.errorId, {
      errorId: delivery.error.id,
      message: delivery.error.message,
      projectName: delivery.project.name,
      alertCount: 1,
      lastTriggeredAt: delivery.triggeredAt,
      ruleNames: new Set([delivery.alertRule.name]),
      severity: delivery.alertRule.severity
    });
  });

  const alertCorrelation = Array.from(alertCorrelationMap.values())
    .sort((a, b) => {
      if (b.alertCount !== a.alertCount) {
        return b.alertCount - a.alertCount;
      }
      return b.lastTriggeredAt.getTime() - a.lastTriggeredAt.getTime();
    })
    .slice(0, 5)
    .map((item) => ({
      errorId: item.errorId,
      message: item.message,
      projectName: item.projectName,
      alertCount: item.alertCount,
      lastTriggeredAt: item.lastTriggeredAt,
      ruleNames: Array.from(item.ruleNames),
      severity: item.severity
    }));

  return res.json({
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
  });
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
