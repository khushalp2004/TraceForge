import prisma from "../db/prisma.js";
import { publishNotificationToUser } from "./notifications.js";

const severityOrder = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2
} as const;

const severityForMessage = (message: string): keyof typeof severityOrder => {
  const lower = message.toLowerCase();
  if (lower.includes("null") || lower.includes("undefined") || lower.includes("typeerror")) {
    return "CRITICAL";
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("rate")) {
    return "WARNING";
  }
  return "INFO";
};

export const evaluateAlertRulesForError = async ({
  errorId,
  projectId,
  environment,
  message,
  count
}: {
  errorId: string;
  projectId: string;
  environment?: string;
  message: string;
  count: number;
}) => {
  const severity = severityForMessage(message);
  const now = new Date();

  const rules = await prisma.alertRule.findMany({
    where: {
      isActive: true,
      AND: [
        {
          OR: [{ projectId }, { projectId: null }]
        },
        environment
          ? {
              OR: [{ environment }, { environment: null }]
            }
          : {
              environment: null
            }
      ]
    },
    include: {
      user: {
        select: {
          id: true
        }
      },
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      orgId: true
    }
  });

  if (!project) {
    return;
  }

  for (const rule of rules) {
    if (severityOrder[severity] < severityOrder[rule.severity]) {
      continue;
    }

    if (count < rule.minOccurrences) {
      continue;
    }

    if (rule.lastTriggeredAt) {
      const cooldownEndsAt =
        rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000;
      if (cooldownEndsAt > now.getTime()) {
        continue;
      }
    }

    const deliveryMessage = `${rule.name} fired for ${project.name}: ${message}`;

    const [delivery] = await prisma.$transaction([
      prisma.alertDelivery.create({
        data: {
          alertRuleId: rule.id,
          projectId,
          errorId,
          environment: environment ?? null,
          message: deliveryMessage
        }
      }),
      prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastTriggeredAt: now
        }
      })
    ]);

    const recipients = new Set<string>([rule.user.id]);

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
        message: deliveryMessage,
        projectId: project.id,
        projectName: project.name,
        ruleId: rule.id,
        errorId,
        environment: environment ?? null,
        severity: rule.severity,
        createdAt: now.toISOString()
      });
    }
  }
};
