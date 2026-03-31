import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const projectSelect = {
  id: true,
  name: true,
  apiKey: true,
  createdAt: true,
  archivedAt: true,
  configuredAt: true,
  lastConfiguredAt: true,
  orgId: true,
  errors: {
    where: { archivedAt: null },
    orderBy: { lastSeen: "desc" as const },
    take: 1,
    select: { lastSeen: true }
  },
  _count: {
    select: {
      errors: {
        where: { archivedAt: null }
      }
    }
  }
} as const;

const PROJECT_CONFIGURATION_STALE_DAYS = 30;
const PROJECT_CONFIGURATION_STALE_MS =
  PROJECT_CONFIGURATION_STALE_DAYS * 24 * 60 * 60 * 1000;

const serializeProject = <
  T extends {
    id: string;
    name: string;
    apiKey: string;
    createdAt: Date;
    archivedAt: Date | null;
    configuredAt: Date | null;
    lastConfiguredAt: Date | null;
    orgId: string | null;
    errors: Array<{ lastSeen: Date }>;
    _count: { errors: number };
  }
>(
  project: T
 ) => {
  const now = Date.now();
  const lastEventAt = project.errors[0]?.lastSeen ?? null;
  const lastSignalAt = project.lastConfiguredAt ?? project.configuredAt ?? lastEventAt;
  const handshakeFresh = Boolean(
    project.lastConfiguredAt &&
      now - project.lastConfiguredAt.getTime() <= PROJECT_CONFIGURATION_STALE_MS
  );
  const legacyConfigured = Boolean(
    lastEventAt && now - lastEventAt.getTime() <= PROJECT_CONFIGURATION_STALE_MS
  );
  const isConfigured = handshakeFresh || legacyConfigured;
  const configurationSource = isConfigured
    ? handshakeFresh
      ? "handshake"
      : "legacy_telemetry"
    : lastSignalAt
      ? "stale"
      : "pending";

  return {
  id: project.id,
  name: project.name,
  apiKey: project.apiKey,
  createdAt: project.createdAt,
  archivedAt: project.archivedAt,
  configuredAt: project.configuredAt ?? lastEventAt,
  lastConfiguredAt: project.lastConfiguredAt ?? lastEventAt,
  orgId: project.orgId,
  telemetryStatus: isConfigured ? "configured" : "not_configured",
  configurationSource,
  lastEventAt,
  eventCount: project._count.errors
  };
};

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
    select: projectSelect
  });

  return res.json({ projects: projects.map(serializeProject) });
});

projectsRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  const { name, orgId } = req.body as { name?: string; orgId?: string };
  const normalizedOrgId = orgId?.trim() || undefined;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Project name is required" });
  }

  if (normalizedOrgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: normalizedOrgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Not a member of that organization" });
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true }
    });
    const proActive =
      user?.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now());

    if (!proActive) {
      const activePersonalProjects = await prisma.project.count({
        where: {
          userId,
          orgId: null,
          archivedAt: null
        }
      });

      if (activePersonalProjects >= 3) {
        return res.status(402).json({
          error: "Free plan supports up to 3 personal projects. Upgrade to Pro to create more."
        });
      }
    }
  }

  const apiKey = crypto.randomBytes(24).toString("hex");

  const project = await prisma.project.create({
    data: {
      userId,
      name: name.trim(),
      apiKey,
      orgId: normalizedOrgId ?? null
    },
    select: projectSelect
  });

  return res.status(201).json({ project: serializeProject(project) });
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
    select: projectSelect
  });

  return res.json({ project: serializeProject(updated) });
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
    select: projectSelect
  });

  return res.json({ project: serializeProject(updated) });
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
    select: projectSelect
  });

  return res.json({ project: serializeProject(updated) });
});
