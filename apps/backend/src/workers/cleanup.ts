import cron from "node-cron";
import prisma from "../db/prisma.js";

// Keep errors for 30 days
const RETENTION_DAYS = 30;

export const startCleanupCron = () => {
  // Run every day at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("[Cleanup Worker] Starting daily cleanup task...");

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      const result = await prisma.errorEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      console.log(`[Cleanup Worker] Successfully deleted ${result.count} old error events (older than ${RETENTION_DAYS} days).`);
    } catch (error) {
      console.error("[Cleanup Worker] Failed to run cleanup task:", error);
    }
  });

  console.log("[Cleanup Worker] Scheduled daily cleanup cron job at 3:00 AM.");
};
