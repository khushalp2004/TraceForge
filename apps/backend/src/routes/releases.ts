import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { limitConcurrentRequests } from "../middleware/concurrency.js";
import { redis } from "../db/redis.js";
import { getCachedAccessibleProjects } from "../utils/access.js";

export const releasesRouter = Router();
const RELEASES_CACHE_TTL_SECONDS = 20;
const releasesConcurrencyLimit = limitConcurrentRequests({
  namespace: "releases:list",
  maxConcurrent: 25,
  message: "Release health is busy right now. Please retry in a moment."
});

releasesRouter.use(requireAuth);

const getAccessibleProjects = async (userId: string) => {
  return getCachedAccessibleProjects(userId);
};

const clearUserReleasesCache = async (userId: string) => {
  if (!redis.isOpen) {
    return;
  }

  const keys: string[] = [];
  for await (const key of redis.scanIterator({ MATCH: `releases:${userId}:*`, COUNT: 100 })) {
    keys.push(String(key));
  }

  if (!keys.length) {
    return;
  }

  await redis.del(keys);
};

releasesRouter.get("/", releasesConcurrencyLimit, async (req, res) => {
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
  const projectNameMap = new Map(projects.map((project) => [project.id, project.name]));

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

  const cacheKey = `releases:${userId}:${projectId || "all"}:${environment || "all"}`;
  if (redis.isOpen) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch {
        // Ignore malformed cache and refresh from DB.
      }
    }
  }

  const where = {
    projectId: { in: filteredProjectIds },
    ...(environment ? { environment } : {})
  };

  const releases = await prisma.release.findMany({
    where,
    orderBy: { releasedAt: "desc" },
    select: {
      id: true,
      version: true,
      environment: true,
      notes: true,
      source: true,
      releasedAt: true,
      createdAt: true,
      projectId: true
    }
  });

  if (!releases.length) {
    const payload = {
      releases: [],
      summary: {
        total: 0,
        healthy: 0,
        monitoring: 0,
        regressions: 0
      }
    };
    if (redis.isOpen) {
      await redis.setEx(cacheKey, RELEASES_CACHE_TTL_SECONDS, JSON.stringify(payload));
    }
    return res.json(payload);
  }

  const releaseIds = releases.map((release) => release.id);

  const [releaseMetricRows, releaseSampleRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ releaseId: string; eventCount: bigint; issueCount: bigint; lastEventAt: Date | null }>
    >(Prisma.sql`
      SELECT
        e."releaseId" AS "releaseId",
        COUNT(*) AS "eventCount",
        COUNT(DISTINCT e."errorId") AS "issueCount",
        MAX(e."timestamp") AS "lastEventAt"
      FROM "ErrorEvent" e
      WHERE e."releaseId" IN (${Prisma.join(releaseIds)})
      GROUP BY e."releaseId"
    `),
    prisma.$queryRaw<
      Array<{
        releaseId: string;
        errorId: string;
        message: string;
        count: number;
        timestamp: Date;
      }>
    >(Prisma.sql`
      SELECT
        ranked."releaseId" AS "releaseId",
        ranked."errorId" AS "errorId",
        ranked."message" AS "message",
        ranked."count" AS "count",
        ranked."timestamp" AS "timestamp"
      FROM (
        SELECT
          e."releaseId",
          e."errorId",
          err."message",
          err."count",
          e."timestamp",
          ROW_NUMBER() OVER (PARTITION BY e."releaseId" ORDER BY e."timestamp" DESC) AS "rn"
        FROM "ErrorEvent" e
        INNER JOIN "Error" err ON err."id" = e."errorId"
        WHERE e."releaseId" IN (${Prisma.join(releaseIds)})
      ) ranked
      WHERE ranked."rn" <= 3
      ORDER BY ranked."releaseId", ranked."timestamp" DESC
    `)
  ]);

  const metricMap = new Map(
    releaseMetricRows.map((row) => [
      row.releaseId,
      {
        eventCount: Number(row.eventCount),
        issueCount: Number(row.issueCount),
        lastEventAt: row.lastEventAt ?? null
      }
    ])
  );
  const sampleIssueMap = new Map<
    string,
    Array<{ id: string; message: string; count: number; timestamp: Date }>
  >();
  releaseSampleRows.forEach((row) => {
    const existing = sampleIssueMap.get(row.releaseId) || [];
    existing.push({
      id: row.errorId,
      message: row.message,
      count: row.count,
      timestamp: row.timestamp
    });
    sampleIssueMap.set(row.releaseId, existing);
  });

  const hydrated = releases.map((release) => {
    const metrics = metricMap.get(release.id) || {
      eventCount: 0,
      issueCount: 0,
      lastEventAt: null
    };
    const eventCount = metrics.eventCount;
    const issueCount = metrics.issueCount;
    const lastEventAt = metrics.lastEventAt;
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
      project: {
        id: release.projectId,
        name: projectNameMap.get(release.projectId) || "Unknown project"
      },
      sampleIssues: sampleIssueMap.get(release.id) || []
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

  const payload = { releases: hydrated, summary };
  if (redis.isOpen) {
    await redis.setEx(cacheKey, RELEASES_CACHE_TTL_SECONDS, JSON.stringify(payload));
  }

  return res.json(payload);
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

  await clearUserReleasesCache(userId);

  return res.status(201).json({ release: created });
});

releasesRouter.delete("/:releaseId", async (req, res) => {
  const userId = req.user?.id;
  const releaseId = typeof req.params.releaseId === "string" ? req.params.releaseId.trim() : "";

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!releaseId) {
    return res.status(400).json({ error: "Release id is required" });
  }

  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: {
      id: true,
      projectId: true,
      version: true
    }
  });

  if (!release) {
    return res.status(404).json({ error: "Release not found" });
  }

  const projects = await getAccessibleProjects(userId);
  const hasAccess = projects.some((project) => project.id === release.projectId);

  if (!hasAccess) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.errorEvent.updateMany({
      where: { releaseId: release.id },
      data: { releaseId: null }
    });

    await tx.release.delete({
      where: { id: release.id }
    });
  });

  await clearUserReleasesCache(userId);

  return res.json({
    ok: true,
    releaseId: release.id,
    version: release.version
  });
});
