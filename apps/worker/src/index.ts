import "dotenv/config";
import prisma from "./db/prisma.js";
import { connectRedis, redis } from "./db/redis.js";
import { generateExplanation } from "./services/groq.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RETENTION_DAYS = 15;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const currentMonthKey = (now: Date) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const formatDetailedSolution = (input: {
  rootCause: string;
  recommendedFix: string;
  nextSteps: string[];
}) =>
  [
    `Root cause\n${input.rootCause}`,
    `Recommended fix\n${input.recommendedFix}`,
    `Next steps\n${input.nextSteps.map((step) => `• ${step}`).join("\n")}`
  ].join("\n\n");

const processError = async (errorId: string) => {
  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    include: { analysis: true, project: { select: { userId: true, aiModel: true } } }
  });

  if (!errorRecord) {
    return;
  }

  if (errorRecord.analysis && errorRecord.aiStatus === "READY") {
    return;
  }

  await prisma.error.update({
    where: { id: errorRecord.id },
    data: {
      aiStatus: "PROCESSING",
      aiLastError: null,
      aiRequestedAt: errorRecord.aiRequestedAt ?? new Date(),
      aiCompletedAt: null
    }
  });

  const ownerId = errorRecord.project.userId;
  const now = new Date();
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { plan: true, planExpiresAt: true }
  });

  const proActive =
    owner?.plan === "PRO" && (!owner.planExpiresAt || owner.planExpiresAt.getTime() > now.getTime());

  if (!proActive) {
    const limit = 20;
    const usageKey = `usage:ai:${ownerId}:${currentMonthKey(now)}`;

    if (redis.isOpen) {
      const current = await redis.incr(usageKey);
      if (current === 1) {
        await redis.expire(usageKey, 60 * 60 * 24 * 45);
      }

      if (current > limit) {
        await redis.decr(usageKey);
        await prisma.error.update({
          where: { id: errorRecord.id },
          data: {
            aiStatus: "FAILED",
            aiLastError: "Monthly AI analysis limit reached for this account.",
            aiCompletedAt: new Date()
          }
        });
        return;
      }
    } else {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const used = await prisma.errorAnalysis.count({
        where: {
          createdAt: { gte: monthStart },
          error: {
            project: {
              userId: ownerId
            }
          }
        }
      });

      if (used >= limit) {
        await prisma.error.update({
          where: { id: errorRecord.id },
          data: {
            aiStatus: "FAILED",
            aiLastError: "Monthly AI analysis limit reached for this account.",
            aiCompletedAt: new Date()
          }
        });
        return;
      }
    }
  }

  try {
    const explanation = await generateExplanation({
      message: errorRecord.message,
      stackTrace: errorRecord.stackTrace,
      model: errorRecord.project.aiModel
    });

    await prisma.errorAnalysis.upsert({
      where: { errorId: errorRecord.id },
      update: {
        aiExplanation: explanation.summary,
        suggestedFix: formatDetailedSolution(explanation)
      },
      create: {
        errorId: errorRecord.id,
        aiExplanation: explanation.summary,
        suggestedFix: formatDetailedSolution(explanation)
      }
    });

    await prisma.error.update({
      where: { id: errorRecord.id },
      data: {
        aiStatus: "READY",
        aiLastError: null,
        aiCompletedAt: new Date()
      }
    });
  } catch (error) {
    await prisma.error.update({
      where: { id: errorRecord.id },
      data: {
        aiStatus: "FAILED",
        aiLastError: error instanceof Error ? error.message : "AI generation failed.",
        aiCompletedAt: new Date()
      }
    });

    throw error;
  }
};

const cleanupArchivedData = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const archivedIssues = await prisma.error.findMany({
    where: {
      archivedAt: {
        lte: cutoff
      }
    },
    select: {
      id: true
    }
  });

  const archivedIssueIds = archivedIssues.map((issue) => issue.id);
  if (archivedIssueIds.length) {
    await prisma.alertDelivery.deleteMany({
      where: {
        errorId: {
          in: archivedIssueIds
        }
      }
    });

    await prisma.errorAnalysis.deleteMany({
      where: {
        errorId: {
          in: archivedIssueIds
        }
      }
    });

    await prisma.errorEvent.deleteMany({
      where: {
        errorId: {
          in: archivedIssueIds
        }
      }
    });

    await prisma.error.deleteMany({
      where: {
        id: {
          in: archivedIssueIds
        }
      }
    });
  }

  await prisma.alertRule.deleteMany({
    where: {
      archivedAt: {
        lte: cutoff
      }
    }
  });

  const archivedProjects = await prisma.project.findMany({
    where: {
      archivedAt: {
        lte: cutoff
      }
    },
    select: {
      id: true
    }
  });

  const archivedProjectIds = archivedProjects.map((project) => project.id);
  if (archivedProjectIds.length) {
    const projectErrors = await prisma.error.findMany({
      where: {
        projectId: {
          in: archivedProjectIds
        }
      },
      select: {
        id: true
      }
    });

    const projectErrorIds = projectErrors.map((error) => error.id);

    await prisma.alertDelivery.deleteMany({
      where: {
        projectId: {
          in: archivedProjectIds
        }
      }
    });

    if (projectErrorIds.length) {
      await prisma.errorAnalysis.deleteMany({
        where: {
          errorId: {
            in: projectErrorIds
          }
        }
      });

      await prisma.errorEvent.deleteMany({
        where: {
          errorId: {
            in: projectErrorIds
          }
        }
      });

      await prisma.error.deleteMany({
        where: {
          id: {
            in: projectErrorIds
          }
        }
      });
    }

    await prisma.alertRule.deleteMany({
      where: {
        projectId: {
          in: archivedProjectIds
        }
      }
    });

    await prisma.project.deleteMany({
      where: {
        id: {
          in: archivedProjectIds
        }
      }
    });
  }

  if (archivedIssueIds.length || archivedProjectIds.length) {
    console.log(
      `Archived cleanup complete: removed ${archivedIssueIds.length} issues and ${archivedProjectIds.length} projects older than ${RETENTION_DAYS} days.`
    );
  }
};

const start = async () => {
  await prisma.$connect();
  await connectRedis();

  console.log("TraceForge worker started. Waiting for jobs...");
  let lastCleanupAt = 0;

  while (true) {
    try {
      if (Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        await cleanupArchivedData();
        lastCleanupAt = Date.now();
      }

      const result = await redis.blPop("ai:queue", 5);
      if (!result) {
        await sleep(1000);
        continue;
      }

      const errorId = result.element;
      await processError(errorId);
    } catch (error) {
      console.error("Worker error", error);
      await sleep(2000);
    }
  }
};

start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
