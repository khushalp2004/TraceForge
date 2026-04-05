import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { publishNotificationToUser } from "../utils/notifications.js";
import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";
import {
  parseJiraMetadata,
  parseSlackMetadata,
  resolveJiraAccessToken
} from "../utils/integrationConnectionState.js";
import {
  createJiraIssue,
  fetchJiraIssueTypes,
  sendSlackMessage
} from "../utils/integrationProviders.js";

export const alertsRouter = Router();
const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";
const jiraClientId = process.env.JIRA_CLIENT_ID || "";
const jiraClientSecret = process.env.JIRA_CLIENT_SECRET || "";

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
      name: true,
      orgId: true
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

const getOwnedAlertRule = async (ruleId: string, userId: string) =>
  prisma.alertRule.findFirst({
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

const getAlertAppTargets = async (rule: Awaited<ReturnType<typeof getOwnedAlertRule>>) => {
  if (!rule?.project?.orgId) {
    return {
      slack: {
        connected: false,
        ready: false,
        label: "Slack",
        reason: "Use an organization project to send Slack alerts."
      },
      jira: {
        connected: false,
        ready: false,
        label: "Jira",
        reason: "Use an organization project to send Jira alerts."
      }
    };
  }

  const connections = await prisma.integrationConnection.findMany({
    where: {
      organizationId: rule.project.orgId,
      provider: {
        in: ["SLACK", "JIRA"]
      }
    }
  });

  const slackConnection = connections.find((entry) => entry.provider === "SLACK") || null;
  const jiraConnection = connections.find((entry) => entry.provider === "JIRA") || null;
  const slackMetadata = parseSlackMetadata(slackConnection?.metadata);
  const jiraMetadata = parseJiraMetadata(jiraConnection?.metadata);

  return {
    slack: {
      connected: Boolean(slackConnection),
      ready: Boolean(slackConnection && slackMetadata.selectedChannelId),
      label: slackMetadata.selectedChannelName
        ? `Slack · #${slackMetadata.selectedChannelName}`
        : "Slack",
      reason: !slackConnection
        ? "Slack is not connected for this organization."
        : !slackMetadata.selectedChannelId
          ? "Choose a default Slack channel in Settings first."
          : undefined
    },
    jira: {
      connected: Boolean(jiraConnection),
      ready: Boolean(
        jiraConnection && jiraMetadata.selectedSiteId && jiraMetadata.selectedProjectId
      ),
      label: jiraMetadata.selectedProjectKey
        ? `Jira · ${jiraMetadata.selectedProjectKey}`
        : "Jira",
      reason: !jiraConnection
        ? "Jira is not connected for this organization."
        : !jiraMetadata.selectedSiteId || !jiraMetadata.selectedProjectId
          ? "Choose a default Jira project in Settings first."
          : undefined
    }
  };
};

const buildAlertMessageBody = ({
  ruleName,
  severity,
  projectName,
  environment,
  issueDescription,
  customMessage
}: {
  ruleName: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  projectName: string;
  environment: string | null;
  issueDescription: string | null;
  customMessage: string;
}) => {
  const details = [
    `Alert: ${ruleName}`,
    `Severity: ${severity}`,
    `Project: ${projectName}`,
    `Environment: ${environment || "All environments"}`
  ];

  if (issueDescription?.trim()) {
    details.push(`Issue: ${issueDescription.trim()}`);
  }

  if (customMessage.trim()) {
    details.push(`Message: ${customMessage.trim()}`);
  }

  details.push(`TraceForge: ${frontendUrl}/dashboard/alerts`);
  return details.join("\n");
};

const pickJiraIssueType = async ({
  accessToken,
  cloudId,
  projectId,
  projectKey
}: {
  accessToken: string;
  cloudId: string;
  projectId: string;
  projectKey?: string;
}) => {
  const issueTypes = await fetchJiraIssueTypes(accessToken, cloudId, projectId);
  const preferredNameOrder = ["Task", "Bug", "Story"];
  const preferred =
    preferredNameOrder
      .map((name) => issueTypes.find((issueType) => issueType.name === name))
      .find(Boolean) || issueTypes[0];

  if (preferred) {
    return preferred;
  }

  if (projectKey) {
    const fallbackTypes = await fetchJiraIssueTypes(accessToken, cloudId, projectKey);
    return (
      preferredNameOrder
        .map((name) => fallbackTypes.find((issueType) => issueType.name === name))
        .find(Boolean) || fallbackTypes[0] || null
    );
  }

  return null;
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
    issueDescription,
    projectId,
    environment,
    severity,
    minOccurrences,
    cooldownMinutes,
    channel
  } = req.body as {
    name?: string;
    issueDescription?: string;
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
      issueDescription: issueDescription?.trim() ? issueDescription.trim() : null,
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
    issueDescription,
    projectId,
    environment,
    severity,
    minOccurrences,
    cooldownMinutes,
    channel,
    isActive
  } = req.body as {
    name?: string;
    issueDescription?: string | null;
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
      ...(issueDescription !== undefined
        ? { issueDescription: issueDescription?.trim() ? issueDescription.trim() : null }
        : {}),
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

alertsRouter.delete("/rules/:id", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const existing = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      userId
    }
  });

  if (!existing) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  if (!existing.archivedAt) {
    return res.status(400).json({ error: "Archive the alert rule before deleting it permanently" });
  }

  await prisma.$transaction([
    prisma.alertDelivery.deleteMany({ where: { alertRuleId: ruleId } }),
    prisma.alertRule.delete({ where: { id: ruleId } })
  ]);

  return res.status(200).json({ status: "deleted" });
});

alertsRouter.post("/rules/:id/notify", async (req, res) => {
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
    return res.status(400).json({ error: "Create a project before sending an alert notification" });
  }

  const now = new Date();
  const alertMessage = `${rule.name} fired for ${project.name}`;
  const issueDescription =
    rule.issueDescription?.trim() || "Alert triggered manually from the alert rules page.";
  const errorHash = crypto
    .createHash("sha256")
    .update(`${rule.id}:${project.id}:${now.toISOString()}`)
    .digest("hex");

  const errorRecord = await prisma.error.create({
    data: {
      projectId: project.id,
      message: alertMessage,
      stackTrace: issueDescription,
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
      environment: rule.environment ?? "manual",
      payload: {
        source: "manual-alert-trigger",
        alertRuleId: rule.id,
        issueDescription
      }
    }
  });

  const delivery = await prisma.alertDelivery.create({
    data: {
      alertRuleId: rule.id,
      projectId: project.id,
      errorId: errorRecord.id,
      environment: rule.environment ?? "manual",
      message: alertMessage,
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
      notificationId: delivery.id,
      title: rule.name,
      message: alertMessage,
      projectId: project.id,
      projectName: project.name,
      ruleId: rule.id,
      errorId: errorRecord.id,
      environment: rule.environment ?? "manual",
      severity: rule.severity,
      createdAt: now.toISOString()
    });
  }

  return res.status(201).json({ delivery });
});

alertsRouter.get("/rules/:id/apps", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rule = await getOwnedAlertRule(ruleId, userId);
  if (!rule) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  const targets = await getAlertAppTargets(rule);

  return res.json({
    rule: {
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      projectName: rule.project?.name ?? "All projects",
      environment: rule.environment,
      issueDescription: rule.issueDescription
    },
    targets
  });
});

alertsRouter.post("/rules/:id/apps/send", async (req, res) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;
  const {
    message,
    destinations
  } = req.body as {
    message?: string;
    destinations?: {
      slack?: boolean;
      jira?: boolean;
    };
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!destinations?.slack && !destinations?.jira) {
    return res.status(400).json({ error: "Choose at least one destination" });
  }

  const rule = await getOwnedAlertRule(ruleId, userId);
  if (!rule) {
    return res.status(404).json({ error: "Alert rule not found" });
  }

  if (!rule.project?.orgId) {
    return res.status(400).json({
      error: "Use an organization project to send alerts to Slack or Jira"
    });
  }

  const appTargets = await getAlertAppTargets(rule);
  const [slackConnection, jiraConnection] = await Promise.all([
    prisma.integrationConnection.findUnique({
      where: {
        provider_organizationId: {
          provider: "SLACK",
          organizationId: rule.project.orgId
        }
      }
    }),
    prisma.integrationConnection.findUnique({
      where: {
        provider_organizationId: {
          provider: "JIRA",
          organizationId: rule.project.orgId
        }
      }
    })
  ]);

  const alertBody = buildAlertMessageBody({
    ruleName: rule.name,
    severity: rule.severity,
    projectName: rule.project.name,
    environment: rule.environment,
    issueDescription: rule.issueDescription,
    customMessage: message || ""
  });

  const results: Record<string, { ok: boolean; label: string; detail?: string }> = {};
  const errors: string[] = [];

  if (destinations.slack) {
    if (!appTargets.slack.ready || !slackConnection) {
      errors.push(appTargets.slack.reason || "Slack is not ready for this workspace");
      results.slack = { ok: false, label: appTargets.slack.label };
    } else {
      try {
        const slackMetadata = parseSlackMetadata(slackConnection.metadata);
        await sendSlackMessage(
          decryptIntegrationSecret(slackConnection.accessTokenEncrypted),
          slackMetadata.selectedChannelId as string,
          `🚨 TraceForge alert\n${alertBody}`
        );
        results.slack = {
          ok: true,
          label: appTargets.slack.label
        };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Failed to send alert to Slack";
        errors.push(detail);
        results.slack = {
          ok: false,
          label: appTargets.slack.label,
          detail
        };
      }
    }
  }

  if (destinations.jira) {
    if (!appTargets.jira.ready || !jiraConnection) {
      errors.push(appTargets.jira.reason || "Jira is not ready for this workspace");
      results.jira = { ok: false, label: appTargets.jira.label };
    } else {
      try {
        const jiraMetadata = parseJiraMetadata(jiraConnection.metadata);
        const { accessToken } = await resolveJiraAccessToken(
          jiraConnection,
          jiraClientId,
          jiraClientSecret
        );
        const issueType = await pickJiraIssueType({
          accessToken,
          cloudId: jiraMetadata.selectedSiteId as string,
          projectId: jiraMetadata.selectedProjectId as string,
          projectKey: jiraMetadata.selectedProjectKey
        });

        if (!issueType) {
          throw new Error("No supported Jira issue type was found for the selected project");
        }

        const jiraIssue = await createJiraIssue({
          accessToken,
          cloudId: jiraMetadata.selectedSiteId as string,
          projectId: jiraMetadata.selectedProjectId as string,
          issueTypeId: issueType.id,
          summary: `[Alert] ${rule.name} · ${rule.project.name}`,
          description: alertBody
        });

        results.jira = {
          ok: true,
          label: appTargets.jira.label,
          detail: jiraIssue.key
        };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Failed to send alert to Jira";
        errors.push(detail);
        results.jira = {
          ok: false,
          label: appTargets.jira.label,
          detail
        };
      }
    }
  }

  const successCount = Object.values(results).filter((result) => result.ok).length;

  if (!successCount) {
    return res.status(400).json({
      error: errors[0] || "Failed to send alert",
      results
    });
  }

  return res.json({
    ok: true,
    results,
    partial: errors.length > 0,
    message:
      errors.length > 0
        ? "Alert sent to some destinations, but at least one destination failed."
        : "Alert sent successfully."
  });
});
