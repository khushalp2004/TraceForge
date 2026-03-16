import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const getUserOrgIds = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return memberships.map((m) => m.organizationId);
};

projectsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  const includeArchived = req.query.includeArchived === "true";
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgIds = await getUserOrgIds(userId);

  const projects = await prisma.project.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, apiKey: true, createdAt: true, archivedAt: true, orgId: true }
  });

  return res.json({ projects });
});

projectsRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  const { name, orgId } = req.body as { name?: string; orgId?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Project name is required" });
  }

  if (orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Not a member of that organization" });
    }
  }

  const apiKey = crypto.randomBytes(24).toString("hex");

  const project = await prisma.project.create({
    data: {
      userId,
      name: name.trim(),
      apiKey,
      orgId: orgId ?? null
    },
    select: { id: true, name: true, apiKey: true, createdAt: true, archivedAt: true, orgId: true }
  });

  return res.status(201).json({ project });
});

projectsRouter.post("/:id/rotate-key", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can rotate keys" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (project.archivedAt) {
    return res.status(400).json({ error: "Archived project cannot rotate key" });
  }

  const newKey = crypto.randomBytes(24).toString("hex");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { apiKey: newKey },
    select: { id: true, name: true, apiKey: true, createdAt: true, archivedAt: true, orgId: true }
  });

  return res.json({ project: updated });
});

projectsRouter.post("/:id/restore", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can restore" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: null },
    select: { id: true, name: true, apiKey: true, createdAt: true, archivedAt: true, orgId: true }
  });

  return res.json({ project: updated });
});

projectsRouter.delete("/:id", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can archive" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!name || name.trim() !== project.name) {
    return res.status(400).json({ error: "Project name confirmation does not match" });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
    select: { id: true, name: true, apiKey: true, createdAt: true, archivedAt: true, orgId: true }
  });

  return res.json({ project: updated });
});
