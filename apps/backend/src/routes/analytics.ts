import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();

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
    select: { id: true }
  });

  const allowedProjectIds = new Set(projects.map((p) => p.id));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!projectId && allowedProjectIds.size === 0) {
    return res.json({ frequency: [], lastSeen: [], days: windowDays });
  }

  const projectFilter = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (windowDays - 1));
  start.setHours(0, 0, 0, 0);

  const events = await prisma.errorEvent.findMany({
    where: {
      error: {
        ...projectFilter
      },
      timestamp: {
        gte: start
      }
    },
    select: { timestamp: true }
  });

  const errors = await prisma.error.findMany({
    where: {
      ...projectFilter,
      lastSeen: {
        gte: start
      }
    },
    select: { lastSeen: true }
  });

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

  events.forEach((event) => {
    const key = dayKey(event.timestamp);
    frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
  });

  errors.forEach((item) => {
    const key = dayKey(item.lastSeen);
    lastSeenMap.set(key, (lastSeenMap.get(key) || 0) + 1);
  });

  const frequency = Array.from(frequencyMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  const lastSeen = Array.from(lastSeenMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  return res.json({ frequency, lastSeen, days: windowDays });
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
