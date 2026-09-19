import prisma from "../db/prisma.js";
import { publishNotificationToUser } from "./notifications.js";

const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";

async function fireWebhook(rule: any, project: any, errorId: string, message: string, severity: string, environment: string | null) {
  if (!rule.webhookUrl) return;
  const errorUrl = `${frontendUrl}/dashboard/errors/${errorId}`;
  
  try {
    if (rule.channel === "SLACK_WEBHOOK") {
      await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[${severity}] ${rule.name} fired for ${project.name}`,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*${rule.name} fired for ${project.name}*\n${message}` }
            },
            {
              type: "actions",
              elements: [
                { type: "button", text: { type: "plain_text", text: "View Error" }, url: errorUrl }
              ]
            }
          ]
        })
      });
    } else if (rule.channel === "DISCORD_WEBHOOK") {
      const color = severity === "CRITICAL" ? 16711680 : severity === "WARNING" ? 16776960 : 65280;
      await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `[${severity}] ${rule.name} fired for ${project.name}`,
            description: message,
            color,
            url: errorUrl,
            footer: { text: `Environment: ${environment || 'production'}` }
          }]
        })
      });
    } else if (rule.channel === "GENERIC_WEBHOOK") {
      await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: rule.id,
          ruleName: rule.name,
          projectId: project.id,
          projectName: project.name,
          errorId,
          message,
          severity,
          environment,
          url: errorUrl
        })
      });
    }
  } catch (err) {
    console.error("Webhook firing failed", err);
  }
}

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

    if (rule.channel === "IN_APP") {
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
    } else {
      await fireWebhook(rule, project, errorId, message, rule.severity, environment ?? null);
    }
  }
};
