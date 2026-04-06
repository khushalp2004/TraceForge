import "dotenv/config";
import prisma from "./db/prisma.js";
import { connectRedis, redis } from "./db/redis.js";
import { generateExplanation } from "./services/groq.js";
import {
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isOrgTeamActive,
  isUserProActive
} from "./utils/billing.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RETENTION_DAYS = 15;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const AI_QUEUE_KEY = "ai:queue";
const AI_PROCESSING_QUEUE_KEY = "ai:processing";
const AI_DEAD_LETTER_QUEUE_KEY = "ai:dead";
const AI_WORKER_INSTANCE_SET_KEY = "worker:ai:instances";
const AI_WORKER_HEARTBEAT_PREFIX = "worker:ai:heartbeat:";
const MAX_AI_JOB_ATTEMPTS = Number(process.env.AI_WORKER_MAX_ATTEMPTS || "3");
const AI_WORKER_CONCURRENCY = Math.max(1, Number(process.env.AI_WORKER_CONCURRENCY || "2"));
const AI_WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
const currentMonthKey = (now: Date) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const currentMonthStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const getFreeEmailUsageRedisKey = (email: string, monthKey: string) =>
  `usage:ai:email:${normalizeEmail(email)}:${monthKey}`;
type AiQueueJob = {
  jobId?: string;
  errorId: string;
  requestedByUserId?: string;
  attempt?: number;
  enqueuedAt?: string;
};

const parseQueueJob = (value: string): AiQueueJob => {
  try {
    const parsed = JSON.parse(value) as AiQueueJob;
    if (typeof parsed?.errorId === "string" && parsed.errorId) {
      return parsed;
    }
  } catch {
    // Old queue payloads were plain error ids.
  }

  return { errorId: value };
};
const normalizeQueueJob = (job: AiQueueJob): Required<Pick<AiQueueJob, "errorId" | "attempt" | "jobId" | "enqueuedAt">> &
  Pick<AiQueueJob, "requestedByUserId"> => ({
  errorId: job.errorId,
  requestedByUserId: job.requestedByUserId,
  attempt: typeof job.attempt === "number" && Number.isFinite(job.attempt) ? job.attempt : 1,
  jobId: job.jobId || `${job.errorId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
  enqueuedAt: job.enqueuedAt || new Date().toISOString()
});
const serializeQueueJob = (job: AiQueueJob) => JSON.stringify(normalizeQueueJob(job));
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

const getPersistedFreeUsageByEmail = async (email: string, now: Date) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true
    }
  });

  const [errorAnalysisCount, usageEntryAggregate, emailUsage] = await Promise.all([
    user
      ? prisma.errorAnalysis.count({
          where: {
            createdAt: { gte: currentMonthStart(now) },
            error: {
              aiRequestedByUserId: user.id
            }
          }
        })
      : Promise.resolve(0),
    prisma.aiUsageEntry.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: currentMonthStart(now) },
        organizationId: null,
        user: {
          email: normalizedEmail
        }
      }
    }),
    prisma.freeAiEmailUsage.findUnique({
      where: {
        email_monthKey: {
          email: normalizedEmail,
          monthKey: currentMonthKey(now)
        }
      },
      select: {
        amount: true
      }
    })
  ]);

  return Math.max(
    errorAnalysisCount,
    usageEntryAggregate._sum.amount || 0,
    emailUsage?.amount || 0
  );
};

const incrementFreeEmailUsage = async (email: string, amount: number, now: Date) => {
  const normalizedEmail = normalizeEmail(email);
  await prisma.freeAiEmailUsage.upsert({
    where: {
      email_monthKey: {
        email: normalizedEmail,
        monthKey: currentMonthKey(now)
      }
    },
    update: {
      amount: {
        increment: amount
      }
    },
    create: {
      email: normalizedEmail,
      monthKey: currentMonthKey(now),
      amount
    }
  });
};

const processError = async ({ errorId, requestedByUserId }: AiQueueJob) => {
  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    include: {
      analysis: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          aiModel: true,
          org: {
            select: {
              plan: true,
              planExpiresAt: true
            }
          }
        }
      }
    }
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
      aiRequestedByUserId: requestedByUserId ?? errorRecord.aiRequestedByUserId ?? null,
      aiCompletedAt: null
    }
  });

  const effectiveRequesterId =
    requestedByUserId ?? errorRecord.aiRequestedByUserId ?? errorRecord.project.userId;
  const now = new Date();
  const requester = await prisma.user.findUnique({
    where: { id: effectiveRequesterId },
    select: { email: true, plan: true, planExpiresAt: true }
  });

  const proActive = isUserProActive(requester);
  const teamActive = Boolean(errorRecord.project.orgId && isOrgTeamActive(errorRecord.project.org));

  if (!proActive) {
    const usageKey = teamActive
      ? `usage:ai:org:${errorRecord.project.orgId}:${currentMonthKey(now)}`
      : requester?.email
        ? getFreeEmailUsageRedisKey(requester.email, currentMonthKey(now))
        : `usage:ai:user:${effectiveRequesterId}:${currentMonthKey(now)}`;
    const limit = teamActive ? TEAM_MONTHLY_AI_LIMIT : FREE_MONTHLY_AI_LIMIT;
    const limitMessage = teamActive
      ? "Monthly AI analysis limit reached for this team."
      : "Monthly AI analysis limit reached for this account.";

    if (redis.isOpen) {
      if (!teamActive && requester?.email) {
        const persistedFreeUsage = await getPersistedFreeUsageByEmail(requester.email, now);
        const existingRedisUsage = Number((await redis.get(usageKey)) || "0");
        if (existingRedisUsage < persistedFreeUsage) {
          await redis.set(usageKey, String(persistedFreeUsage));
          await redis.expire(usageKey, 60 * 60 * 24 * 45);
        }
      }

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
            aiLastError: limitMessage,
            aiCompletedAt: new Date()
          }
        });
        return;
      }
    } else {
      const used = teamActive
        ? await prisma.errorAnalysis.count({
            where: {
              createdAt: { gte: currentMonthStart(now) },
              error: {
                project: {
                  orgId: errorRecord.project.orgId
                }
              }
            }
          })
        : requester?.email
          ? await getPersistedFreeUsageByEmail(requester.email, now)
          : await prisma.errorAnalysis.count({
              where: {
                createdAt: { gte: currentMonthStart(now) },
                error: {
                  aiRequestedByUserId: effectiveRequesterId
                }
              }
            });

      if (used >= limit) {
        await prisma.error.update({
          where: { id: errorRecord.id },
          data: {
            aiStatus: "FAILED",
            aiLastError: limitMessage,
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

    if (!teamActive && !proActive && requester?.email) {
      await incrementFreeEmailUsage(requester.email, 1, now);
    }
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

const ackQueueJob = async (rawJob: string) => {
  if (!redis.isOpen) {
    return;
  }
  await redis.lRem(AI_PROCESSING_QUEUE_KEY, 1, rawJob);
};

const moveStaleProcessingJobsBackToQueue = async () => {
  if (!redis.isOpen) {
    return;
  }

  const inFlightJobs = await redis.lRange(AI_PROCESSING_QUEUE_KEY, 0, -1);
  if (!inFlightJobs.length) {
    return;
  }

  for (const rawJob of inFlightJobs) {
    await redis.lRem(AI_PROCESSING_QUEUE_KEY, 1, rawJob);
    await redis.rPush(AI_QUEUE_KEY, rawJob);
  }

  console.log(`Recovered ${inFlightJobs.length} in-flight AI job(s) back to the queue.`);
};

const handleFailedQueueJob = async (rawJob: string, job: AiQueueJob, error: unknown) => {
  if (!redis.isOpen) {
    return;
  }

  const normalized = normalizeQueueJob(job);
  await ackQueueJob(rawJob);

  if (normalized.attempt >= MAX_AI_JOB_ATTEMPTS) {
    await redis.lPush(
      AI_DEAD_LETTER_QUEUE_KEY,
      JSON.stringify({
        ...normalized,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown worker error"
      })
    );
    return;
  }

  await redis.lPush(
    AI_QUEUE_KEY,
    serializeQueueJob({
      ...normalized,
      attempt: normalized.attempt + 1,
      enqueuedAt: new Date().toISOString()
    })
  );
};

const publishWorkerHeartbeat = async (instanceId: string) => {
  if (!redis.isOpen) {
    return;
  }

  const payload = {
    instanceId,
    pid: process.pid,
    concurrency: AI_WORKER_CONCURRENCY,
    updatedAt: new Date().toISOString()
  };

  await redis.sAdd(AI_WORKER_INSTANCE_SET_KEY, instanceId);
  await redis.set(
    `${AI_WORKER_HEARTBEAT_PREFIX}${instanceId}`,
    JSON.stringify(payload),
    {
      EX: Math.ceil((AI_WORKER_HEARTBEAT_INTERVAL_MS * 3) / 1000)
    }
  );
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
  await moveStaleProcessingJobsBackToQueue();
  const instanceId = `${process.pid}-${Date.now().toString(36)}`;
  await publishWorkerHeartbeat(instanceId);

  console.log(`TraceForge worker started. Waiting for jobs with concurrency ${AI_WORKER_CONCURRENCY}.`);
  let lastCleanupAt = 0;
  let shuttingDown = false;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const runCleanupLoop = async () => {
    while (!shuttingDown) {
      try {
        if (Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
          await cleanupArchivedData();
          lastCleanupAt = Date.now();
        }
      } catch (error) {
        console.error("Cleanup loop error", error);
      }

      await sleep(15_000);
    }
  };

  const workerTasks = Array.from({ length: AI_WORKER_CONCURRENCY }, (_, index) =>
    (async () => {
      while (!shuttingDown) {
        let rawJob: string | null = null;
        let job: AiQueueJob | null = null;

        try {
          rawJob = await redis.blMove(
            AI_QUEUE_KEY,
            AI_PROCESSING_QUEUE_KEY,
            "RIGHT",
            "LEFT",
            5
          );
          if (!rawJob) {
            await sleep(250);
            continue;
          }

          job = normalizeQueueJob(parseQueueJob(rawJob));
          await processError(job);
          await ackQueueJob(rawJob);
        } catch (error) {
          if (rawJob && job) {
            await handleFailedQueueJob(rawJob, job, error);
          } else {
            console.error(`Worker loop ${index + 1} error`, error);
            await sleep(1000);
          }
        }
      }
    })()
  );

  const stop = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`TraceForge worker shutting down (${signal})...`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (redis.isOpen) {
      await redis.sRem(AI_WORKER_INSTANCE_SET_KEY, instanceId).catch(() => undefined);
      await redis.del(`${AI_WORKER_HEARTBEAT_PREFIX}${instanceId}`).catch(() => undefined);
    }
    await sleep(350);
    if (redis.isOpen) {
      await redis.quit().catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void stop("SIGTERM");
  });
  process.on("SIGINT", () => {
    void stop("SIGINT");
  });

  heartbeatInterval = setInterval(() => {
    void publishWorkerHeartbeat(instanceId);
  }, AI_WORKER_HEARTBEAT_INTERVAL_MS);
  heartbeatInterval.unref();

  await Promise.all([runCleanupLoop(), ...workerTasks]);
};

start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
