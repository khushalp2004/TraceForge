import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const releasesRouter = Router();

releasesRouter.use(requireAuth);

const getUserOrgIds = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return memberships.map((membership) => membership.organizationId);
};

const getAccessibleProjects = async (userId: string) => {
  const orgIds = await getUserOrgIds(userId);
  return prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    select: { id: true, name: true, orgId: true }
  });
};

releasesRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, environment } = req.query as {
    projectId?: string;
    environment?: string;
  };

  const projects = await getAccessibleProjects(userId);
  const allowedProjectIds = new Set(projects.map((project) => project.id));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const filteredProjectIds = projectId ? [projectId] : Array.from(allowedProjectIds);
  if (!filteredProjectIds.length) {
    return res.json({
      releases: [],
      summary: {
        total: 0,
        healthy: 0,
        monitoring: 0,
        regressions: 0
      }
    });
  }

  const where = {
    projectId: { in: filteredProjectIds },
    ...(environment ? { environment } : {})
  };

  const releases = await prisma.release.findMany({
    where,
    orderBy: { releasedAt: "desc" },
    include: {
      project: {
        select: { id: true, name: true }
      },
      events: {
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          errorId: true,
          timestamp: true,
          error: {
            select: {
              id: true,
              message: true,
              count: true
            }
          }
        }
      }
    }
  });

  const hydrated = releases.map((release) => {
    const distinctIssueIds = new Set(release.events.map((event) => event.errorId));
    const issueCount = distinctIssueIds.size;
    const eventCount = release.events.length;
    const lastEventAt = release.events[0]?.timestamp ?? null;
    const health =
      eventCount === 0 ? "healthy" : eventCount <= 5 && issueCount <= 2 ? "monitoring" : "regression";

    return {
      id: release.id,
      version: release.version,
      environment: release.environment,
      notes: release.notes,
      source: release.source,
      releasedAt: release.releasedAt,
      createdAt: release.createdAt,
      health,
      issueCount,
      eventCount,
      lastEventAt,
      project: release.project,
      sampleIssues: release.events.slice(0, 3).map((event) => ({
        id: event.error.id,
        message: event.error.message,
        timestamp: event.timestamp,
        count: event.error.count
      }))
    };
  });

  const summary = hydrated.reduce(
    (acc, release) => {
      acc.total += 1;
      if (release.health === "healthy") acc.healthy += 1;
      if (release.health === "monitoring") acc.monitoring += 1;
      if (release.health === "regression") acc.regressions += 1;
      return acc;
    },
    { total: 0, healthy: 0, monitoring: 0, regressions: 0 }
  );

  return res.json({ releases: hydrated, summary });
});

releasesRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, version, environment, notes, releasedAt } = req.body as {
    projectId?: string;
    version?: string;
    environment?: string;
    notes?: string;
    releasedAt?: string;
  };

  if (!projectId || !version?.trim()) {
    return res.status(400).json({ error: "Project and version are required" });
  }

  const projects = await getAccessibleProjects(userId);
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const created = await prisma.release.upsert({
    where: {
      projectId_version: {
        projectId,
        version: version.trim()
      }
    },
    update: {
      environment: environment?.trim() || null,
      notes: notes?.trim() || null,
      source: "MANUAL",
      releasedAt: releasedAt ? new Date(releasedAt) : new Date()
    },
    create: {
      projectId,
      version: version.trim(),
      environment: environment?.trim() || null,
      notes: notes?.trim() || null,
      source: "MANUAL",
      releasedAt: releasedAt ? new Date(releasedAt) : new Date()
    },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });

  return res.status(201).json({ release: created });
});
