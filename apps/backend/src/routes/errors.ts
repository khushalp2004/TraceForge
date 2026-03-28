import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../db/redis.js";
import type { Prisma } from "@prisma/client";

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

  const { projectId, q, env, sort, severity, page, pageSize } = req.query as {
    projectId?: string;
    q?: string;
    env?: string;
    severity?: "critical" | "warning" | "info";
    sort?: "lastSeen" | "count";
    page?: string;
    pageSize?: string;
  };
  const archivedOnly = req.query.archivedOnly === "true";
  const currentPage = Math.max(1, Number.parseInt(page || "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, Number.parseInt(pageSize || "5", 10) || 5));

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

  const baseWhere: Prisma.ErrorWhereInput = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const andConditions: Prisma.ErrorWhereInput[] = [
    baseWhere,
    {
      archivedAt: archivedOnly ? { not: null } : null
    }
  ];

  if (q) {
    andConditions.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { stackTrace: { contains: q, mode: "insensitive" } },
        { analysis: { is: { aiExplanation: { contains: q, mode: "insensitive" } } } },
        { project: { name: { contains: q, mode: "insensitive" } } }
      ]
    });
  }

  if (env) {
    andConditions.push({
      events: {
        some: {
          environment: env
        }
      }
    });
  }

  if (severity === "critical") {
    andConditions.push({
      OR: [
        { message: { contains: "null", mode: "insensitive" } },
        { message: { contains: "undefined", mode: "insensitive" } },
        { message: { contains: "typeerror", mode: "insensitive" } }
      ]
    });
  }

  if (severity === "warning") {
    andConditions.push({
      AND: [
        {
          OR: [
            { message: { contains: "timeout", mode: "insensitive" } },
            { message: { contains: "network", mode: "insensitive" } },
            { message: { contains: "rate", mode: "insensitive" } }
          ]
        },
        {
          NOT: {
            OR: [
              { message: { contains: "null", mode: "insensitive" } },
              { message: { contains: "undefined", mode: "insensitive" } },
              { message: { contains: "typeerror", mode: "insensitive" } }
            ]
          }
        }
      ]
    });
  }

  if (severity === "info") {
    andConditions.push({
      NOT: {
        OR: [
          { message: { contains: "null", mode: "insensitive" } },
          { message: { contains: "undefined", mode: "insensitive" } },
          { message: { contains: "typeerror", mode: "insensitive" } },
          { message: { contains: "timeout", mode: "insensitive" } },
          { message: { contains: "network", mode: "insensitive" } },
          { message: { contains: "rate", mode: "insensitive" } }
        ]
      }
    });
  }

  const where: Prisma.ErrorWhereInput = { AND: andConditions };

  const orderBy: Prisma.ErrorOrderByWithRelationInput =
    sort === "count" ? { count: "desc" } : { lastSeen: "desc" };

  const [errors, total] = await Promise.all([
    prisma.error.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * perPage,
      take: perPage,
      include: {
        analysis: true
      }
    }),
    prisma.error.count({ where })
  ]);

  return res.json({
    errors,
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage))
    }
  });
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

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
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

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
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

errorsRouter.post("/:id/archive", async (req, res) => {
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

  if (errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_archived" });
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

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: new Date() }
  });

  return res.status(200).json({ status: "archived" });
});

errorsRouter.post("/:id/restore", async (req, res) => {
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

  if (!errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_active" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Project is archived" });
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

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: null }
  });

  return res.status(200).json({ status: "restored" });
});
