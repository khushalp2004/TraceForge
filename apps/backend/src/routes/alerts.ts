import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { publishNotificationToUser } from "../utils/notifications.js";

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

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
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      orgId: true
    }
  });
};

const alertInclude = {
  project: {
    select: {
      id: true,
      name: true
    }
  },
  _count: {
    select: {
      deliveries: true
    }
  }
} as const;

const getAlertRecipients = async (projectId: string | null, creatorId: string) => {
  const recipients = new Set<string>([creatorId]);

  if (!projectId) {
    return recipients;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true }
  });

  if (!project?.orgId) {
    return recipients;
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { organizationId: project.orgId },
    select: { userId: true }
  });

  for (const membership of memberships) {
    recipients.add(membership.userId);
  }

  return recipients;
};

alertsRouter.get("/rules", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const archived = req.query.archived === "true";

  const projects = await getAccessibleProjects(userId);
  const projectIds = projects.map((project) => project.id);

  const rules = await prisma.alertRule.findMany({
    where: {
      archivedAt: archived ? { not: null } : null,
      OR: [
        { userId },
        {
          projectId: {
            in: projectIds
          }
        }
      ]
    },
    include: alertInclude,
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
  });

  return res.json({ rules });
});

alertsRouter.get("/projects", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const projects = await getAccessibleProjects(userId);
  return res.json({ projects });
});

alertsRouter.get("/events", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const includeTests = req.query.includeTests === "true";

  const projects = await getAccessibleProjects(userId);
  const projectIds = projects.map((project) => project.id);

  const events = await prisma.alertDelivery.findMany({
    where: {
      alertRule: {
        archivedAt: null
      },
      ...(includeTests
        ? {}
        : {
            message: {
              not: {
                startsWith: "[Test alert]"
              }
            }
          }),
      projectId: {
        in: projectIds
      }
    },
    orderBy: { triggeredAt: "desc" },
    take: 20,
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      },
      error: {
        select: {
          id: true,
          count: true
        }
      },
      alertRule: {
        select: {
          id: true,
          name: true,
          severity: true
        }
      }
    }
  });

  return res.json({ events });
});

alertsRouter.post("/rules", async (req, res) => {
  const userId = req.user?.id;
  const {
    name,
    projectId,
    environment,
    severity,
    minOccurrences,
    cooldownMinutes,
    channel
  } = req.body as {
    name?: string;
    projectId?: string;
    environment?: string;
    severity?: "INFO" | "WARNING" | "CRITICAL";
    minOccurrences?: number;
    cooldownMinutes?: number;
    channel?: "IN_APP";
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Rule name is required" });
  }

  const allowedProjects = await getAccessibleProjects(userId);
  if (projectId && !allowedProjects.some((project) => project.id === projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rule = await prisma.alertRule.create({
    data: {
      userId,
      name: name.trim(),
      projectId: projectId || null,
      environment: environment?.trim() ? environment.trim() : null,
      severity: severity ?? "CRITICAL",
      minOccurrences:
        typeof minOccurrences === "number" && minOccurrences > 0 ? minOccurrences : 1,
      cooldownMinutes:
        typeof cooldownMinutes === "number" && cooldownMinutes > 0 ? cooldownMinutes : 30,
      channel: channel ?? "IN_APP"
    },
    include: alertInclude
  });

  const recipients = await getAlertRecipients(rule.project?.id ?? null, userId);
  const scopeName = rule.project?.name ?? "all projects";

  for (const recipientId of recipients) {
    publishNotificationToUser(recipientId, {
      type: "alert.created",
      title: rule.name,
      message: `Alert created for ${scopeName}`,
      projectId: rule.project?.id,
      projectName: scopeName,
      ruleId: rule.id,
      severity: rule.severity,
      createdAt: rule.createdAt.toISOString()
    });
  }

  return res.status(201).json({ rule });
});

alertsRouter.patch("/rules/:id", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;
  const {
    name,
    projectId,
    environment,
    severity,
    minOccurrences,
    cooldownMinutes,
    channel,
    isActive
  } = req.body as {
    name?: string;
    projectId?: string | null;
    environment?: string | null;
    severity?: "INFO" | "WARNING" | "CRITICAL";
    minOccurrences?: number;
    cooldownMinutes?: number;
    channel?: "IN_APP";
    isActive?: boolean;
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const existing = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      userId,
      archivedAt: null
    }
  });

  if (!existing) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  const allowedProjects = await getAccessibleProjects(userId);
  if (projectId && !allowedProjects.some((project) => project.id === projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rule = await prisma.alertRule.update({
    where: { id: ruleId },
    data: {
      ...(typeof name === "string" ? { name: name.trim() || existing.name } : {}),
      ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      ...(environment !== undefined
        ? { environment: environment?.trim() ? environment.trim() : null }
        : {}),
      ...(severity ? { severity } : {}),
      ...(typeof minOccurrences === "number" && minOccurrences > 0
        ? { minOccurrences }
        : {}),
      ...(typeof cooldownMinutes === "number" && cooldownMinutes > 0
        ? { cooldownMinutes }
        : {}),
      ...(channel ? { channel } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {})
    },
    include: alertInclude
  });

  return res.json({ rule });
});

alertsRouter.post("/rules/:id/archive", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const existing = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      userId,
      archivedAt: null
    }
  });

  if (!existing) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  const project = existing.projectId
    ? await prisma.project.findUnique({
        where: { id: existing.projectId },
        select: { id: true, name: true }
      })
    : null;
  const recipients = await getAlertRecipients(existing.projectId, userId);

  await prisma.alertRule.update({
    where: { id: ruleId },
    data: {
      archivedAt: new Date(),
      isActive: false
    }
  });

  for (const recipientId of recipients) {
    publishNotificationToUser(recipientId, {
      type: "alert.deleted",
      title: existing.name,
      message: `Alert archived for ${project?.name ?? "all projects"}`,
      projectId: project?.id,
      projectName: project?.name ?? "all projects",
      ruleId,
      severity: existing.severity,
      createdAt: new Date().toISOString()
    });
  }

  return res.status(200).json({ status: "archived" });
});

alertsRouter.post("/rules/:id/restore", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const existing = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      userId,
      archivedAt: {
        not: null
      }
    }
  });

  if (!existing) {
    return res.status(404).json({ error: "Archived alert rule not found" });
  }

  const rule = await prisma.alertRule.update({
    where: { id: ruleId },
    data: {
      archivedAt: null
    },
    include: alertInclude
  });

  return res.status(200).json({ rule });
});

alertsRouter.post("/rules/:id/test", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rule = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      userId,
      archivedAt: null
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          orgId: true
        }
      }
    }
  });

  if (!rule) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  const accessibleProjects = await getAccessibleProjects(userId);
  const project =
    (rule.projectId
      ? accessibleProjects.find((entry) => entry.id === rule.projectId)
      : accessibleProjects[0]) ?? null;

  if (!project) {
    return res.status(400).json({ error: "Create a project before sending a test alert" });
  }

  const now = new Date();
  const testMessage = `[Test alert] ${rule.name} fired for ${project.name}`;
  const errorHash = crypto
    .createHash("sha256")
    .update(`${rule.id}:${project.id}:${now.toISOString()}`)
    .digest("hex");

  const errorRecord = await prisma.error.create({
    data: {
      projectId: project.id,
      message: testMessage,
      stackTrace: "Test alert triggered manually from the alert rules page.",
      hash: errorHash,
      firstSeen: now,
      lastSeen: now,
      count: Math.max(rule.minOccurrences, 1)
    }
  });

  await prisma.errorEvent.create({
    data: {
      errorId: errorRecord.id,
      timestamp: now,
      environment: rule.environment ?? "test",
      payload: {
        source: "manual-test-alert",
        alertRuleId: rule.id
      }
    }
  });

  const delivery = await prisma.alertDelivery.create({
    data: {
      alertRuleId: rule.id,
      projectId: project.id,
      errorId: errorRecord.id,
      environment: rule.environment ?? "test",
      message: testMessage,
      triggeredAt: now
    },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      },
      error: {
        select: {
          id: true,
          count: true
        }
      },
      alertRule: {
        select: {
          id: true,
          name: true,
          severity: true
        }
      }
    }
  });

  await prisma.alertRule.update({
    where: { id: rule.id },
    data: {
      lastTriggeredAt: now
    }
  });

  const recipients = new Set<string>([rule.userId]);

  if (project.orgId) {
    const memberships = await prisma.organizationMember.findMany({
      where: { organizationId: project.orgId },
      select: { userId: true }
    });

    for (const membership of memberships) {
      recipients.add(membership.userId);
    }
  }

  for (const recipientId of recipients) {
    publishNotificationToUser(recipientId, {
      type: "alert.triggered",
      title: rule.name,
      message: testMessage,
      projectId: project.id,
      projectName: project.name,
      ruleId: rule.id,
      errorId: errorRecord.id,
      environment: rule.environment ?? "test",
      severity: rule.severity,
      isTest: true,
      createdAt: now.toISOString()
    });
  }

  return res.status(201).json({ delivery });
});
