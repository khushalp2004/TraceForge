import cron from "node-cron";
import prisma from "../db/prisma.js";
import { sendEmail } from "../utils/mailer.js";

const DAYS_IN_DIGEST = 7;
const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";

export const generateAndSendDigestForProject = async (projectId: string, cutoffDate: Date) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: {
        include: {
          members: {
            include: { user: true }
          }
        }
      },
      user: true // project owner
    }
  });

  if (!project) return;

  // Aggregate stats
  const newErrorsCount = await prisma.error.count({
    where: {
      projectId,
      firstSeen: { gte: cutoffDate }
    }
  });

  const totalEventsCount = await prisma.errorEvent.count({
    where: {
      error: { projectId },
      timestamp: { gte: cutoffDate }
    }
  });

  const resolvedErrorsCount = await prisma.error.count({
    where: {
      projectId,
      status: "RESOLVED",
      lastSeen: { gte: cutoffDate }
    }
  });

  if (newErrorsCount === 0 && totalEventsCount === 0 && resolvedErrorsCount === 0) {
    // Nothing happened this week, don't send an empty digest
    return;
  }

  const recipients = new Set<string>();
  if (project.org) {
    for (const member of project.org.members) {
      if (member.user.email) {
        recipients.add(member.user.email);
      }
    }
  } else if (project.user?.email) {
    recipients.add(project.user.email);
  }

  if (recipients.size === 0) return;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Weekly Digest for ${project.name}</h2>
      <p style="color: #666; font-size: 16px;">Here's a summary of what happened in your project over the last 7 days.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-top: 20px;">
        <ul style="list-style-type: none; padding: 0; margin: 0; font-size: 18px; color: #111;">
          <li style="margin-bottom: 12px;">🔴 <b>${newErrorsCount}</b> new issues discovered</li>
          <li style="margin-bottom: 12px;">📈 <b>${totalEventsCount}</b> total error events logged</li>
          <li>✅ <b>${resolvedErrorsCount}</b> issues resolved</li>
        </ul>
      </div>

      <div style="margin-top: 30px;">
        <a href="${frontendUrl}/dashboard/projects/${project.id}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">View Project Dashboard</a>
      </div>
      
      <p style="margin-top: 40px; font-size: 12px; color: #999;">
        You're receiving this email because you are a member of ${project.name} on TraceForge.
      </p>
    </div>
  `;

  for (const email of recipients) {
    try {
      await sendEmail({
        to: email,
        subject: `Weekly Digest: ${project.name}`,
        text: `Weekly Digest for ${project.name}\n\n${newErrorsCount} new issues\n${totalEventsCount} total events\n${resolvedErrorsCount} issues resolved\n\nView at: ${frontendUrl}/dashboard/projects/${project.id}`,
        html
      });
    } catch (err) {
      console.error(`[Digest Worker] Failed to send email to ${email}`, err);
    }
  }
};

export const startDigestCron = () => {
  // Run every Monday at 9:00 AM UTC
  cron.schedule("0 9 * * 1", async () => {
    console.log("[Digest Worker] Starting weekly digest task...");

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DAYS_IN_DIGEST);

      const projects = await prisma.project.findMany({
        where: { archivedAt: null },
        select: { id: true }
      });

      console.log(`[Digest Worker] Found ${projects.length} active projects to process.`);

      for (const p of projects) {
        await generateAndSendDigestForProject(p.id, cutoffDate);
      }

      console.log("[Digest Worker] Successfully sent weekly digests.");
    } catch (error) {
      console.error("[Digest Worker] Failed to run weekly digest task:", error);
    }
  });

  console.log("[Digest Worker] Scheduled weekly digest cron job for Monday 9:00 AM.");
};
