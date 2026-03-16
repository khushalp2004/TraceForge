import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../db/redis.js";

export const errorsRouter = Router();

errorsRouter.use(requireAuth);

const getUserOrgIds = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return memberships.map((m) => m.organizationId);
};

errorsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, q, env, sort } = req.query as {
    projectId?: string;
    q?: string;
    env?: string;
    sort?: "lastSeen" | "count";
  };

  const orgIds = await getUserOrgIds(userId);

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

  const baseWhere = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const where: Record<string, unknown> = {
    ...baseWhere
  };

  if (q) {
    where.message = { contains: q, mode: "insensitive" };
  }

  if (env) {
    where.events = {
      some: {
        environment: env
      }
    };
  }

  const orderBy = sort === "count" ? { count: "desc" } : { lastSeen: "desc" };

  const errors = await prisma.error.findMany({
    where,
    orderBy,
    take: 50,
    include: {
      analysis: true
    }
  });

  return res.json({ errors });
});

errorsRouter.get("/:id", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    include: {
      analysis: true,
      project: true,
      events: {
        orderBy: { timestamp: "desc" },
        take: 10
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  return res.json({ error: errorRecord });
});

errorsRouter.post("/:id/regenerate", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    include: { project: true }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.errorAnalysis.deleteMany({
    where: { errorId }
  });

  if (redis.isOpen) {
    await redis.lPush("ai:queue", errorId);
  }

  return res.status(202).json({ status: "queued" });
});
