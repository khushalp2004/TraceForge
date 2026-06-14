import "dotenv/config";
import prisma from "./db/prisma.js";
import { connectRedis, redis } from "./db/redis.js";
import { generateExplanation } from "./services/groq.js";
import {
  GithubRepoAnalysisStatus
} from "@prisma/client";
import {
  runGithubRepoAnalysis,
  syncRepoFileChunks
} from "./services/githubRepoAnalysis.js";
import {
  createAiQueueEvents,
  createAiWorker,
  createGithubAnalysisWorker,
  createGithubQueueEvents,
  createBillingReconciliationWorker
} from "./queue/queues.js";
import { processBillingReconciliation } from "./services/billingReconciliation.js";
import {
  DEV_MONTHLY_AI_LIMIT,
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isOrgTeamActive,
  isUserDevActive,
  isUserProActive
} from "./utils/billing.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RETENTION_DAYS = 15;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const AI_QUEUE_KEY = "ai:queue";
const AI_PROCESSING_QUEUE_KEY = "ai:processing";
const AI_DEAD_LETTER_QUEUE_KEY = "ai:dead";
const GITHUB_ANALYSIS_QUEUE_KEY = "github:analysis:queue";
const GITHUB_ANALYSIS_PROCESSING_QUEUE_KEY = "github:analysis:processing";
const GITHUB_ANALYSIS_DEAD_LETTER_QUEUE_KEY = "github:analysis:dead";
const getAiRegenerateLockKey = (errorId: string) => `lock:ai:regenerate:${errorId}`;
const AI_WORKER_INSTANCE_SET_KEY = "worker:ai:instances";
const AI_WORKER_HEARTBEAT_PREFIX = "worker:ai:heartbeat:";
const AI_WORKER_PROCESSING_JOB_PREFIX = "worker:ai:processing:";
const MAX_AI_JOB_ATTEMPTS = Number(process.env.AI_WORKER_MAX_ATTEMPTS || "3");
const AI_WORKER_CONCURRENCY = Math.max(1, Number(process.env.AI_WORKER_CONCURRENCY || "2"));
const MAX_GITHUB_ANALYSIS_JOB_ATTEMPTS = Number(process.env.GITHUB_ANALYSIS_WORKER_MAX_ATTEMPTS || "2");
const GITHUB_ANALYSIS_WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.GITHUB_ANALYSIS_WORKER_CONCURRENCY || "1")
);
const AI_WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
const AI_GROQ_TIMEOUT_MS = Math.max(5_000, Number(process.env.AI_GROQ_TIMEOUT_MS || "45000"));
const AI_PROCESSING_STALE_MS = Math.max(
  AI_GROQ_TIMEOUT_MS + 30_000,
  Number(process.env.AI_PROCESSING_STALE_MS || String(AI_GROQ_TIMEOUT_MS + 30_000))
);
const AI_ORPHAN_REQUEST_STALE_MS = Math.max(
  AI_PROCESSING_STALE_MS * 2,
  Number(process.env.AI_ORPHAN_REQUEST_STALE_MS || "180000")
);
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
type GithubAnalysisQueueJob = {
  projectId: string;
  userId: string;
  orgId?: string | null;
  requesterEmail?: string | null;
  chargeCredits?: boolean;
  incrementFreeEmailUsage?: boolean;
  usageCost?: number;
  attempt?: number;
  enqueuedAt?: string;
  analysisType?: string;
  syncPayload?: {
    filesToSync: string[];
    filesToRemove: string[];
  };
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
const parseGithubAnalysisQueueJob = (value: string): GithubAnalysisQueueJob => {
  const parsed = JSON.parse(value) as GithubAnalysisQueueJob;
  if (!parsed?.projectId || !parsed?.userId) {
    throw new Error("Invalid GitHub analysis queue payload");
  }
  return parsed;
};
const rawQueueJobHasIdentity = (rawJob: string) => {
  try {
    const parsed = JSON.parse(rawJob) as AiQueueJob;
    return Boolean(parsed?.jobId && parsed?.enqueuedAt);
  } catch {
    return false;
  }
};
const normalizeGithubAnalysisQueueJob = (
  job: GithubAnalysisQueueJob
): Required<Pick<GithubAnalysisQueueJob, "projectId" | "userId" | "attempt" | "enqueuedAt">> &
  Pick<
    GithubAnalysisQueueJob,
    "orgId" | "requesterEmail" | "chargeCredits" | "incrementFreeEmailUsage" | "usageCost" | "analysisType" | "syncPayload"
  > => ({
  projectId: job.projectId,
  userId: job.userId,
  orgId: job.orgId ?? null,
  requesterEmail: job.requesterEmail ?? null,
  chargeCredits: Boolean(job.chargeCredits),
  incrementFreeEmailUsage: Boolean(job.incrementFreeEmailUsage),
  usageCost: typeof job.usageCost === "number" && Number.isFinite(job.usageCost) ? job.usageCost : 0,
  attempt: typeof job.attempt === "number" && Number.isFinite(job.attempt) ? job.attempt : 1,
  enqueuedAt: job.enqueuedAt || new Date().toISOString(),
  analysisType: job.analysisType || "report",
  syncPayload: job.syncPayload
});
const serializeGithubAnalysisQueueJob = (job: GithubAnalysisQueueJob) =>
  JSON.stringify(normalizeGithubAnalysisQueueJob(job));
const normalizeQueueJob = (job: AiQueueJob): Required<Pick<AiQueueJob, "errorId" | "attempt" | "jobId" | "enqueuedAt">> &
  Pick<AiQueueJob, "requestedByUserId"> => ({
  errorId: job.errorId,
  requestedByUserId: job.requestedByUserId,
  attempt: typeof job.attempt === "number" && Number.isFinite(job.attempt) ? job.attempt : 1,
  jobId: job.jobId || `${job.errorId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
  enqueuedAt: job.enqueuedAt || new Date().toISOString()
});
const serializeQueueJob = (job: AiQueueJob) => JSON.stringify(normalizeQueueJob(job));
const getProcessingMetadataKey = (jobId: string) => `${AI_WORKER_PROCESSING_JOB_PREFIX}${jobId}`;
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

const releaseRegenerateLock = async (errorId: string) => {
  if (!redis.isOpen) {
    return;
  }

  await redis.del(getAiRegenerateLockKey(errorId));
};

const markProcessingJob = async (
  job: ReturnType<typeof normalizeQueueJob>,
  instanceId: string
) => {
  if (!redis.isOpen) {
    return;
  }

  await redis.set(
    getProcessingMetadataKey(job.jobId),
    JSON.stringify({
      jobId: job.jobId,
      errorId: job.errorId,
      attempt: job.attempt,
      instanceId,
      pid: process.pid,
      enqueuedAt: job.enqueuedAt,
      startedAt: new Date().toISOString()
    }),
    {
      EX: Math.ceil((AI_PROCESSING_STALE_MS * 2) / 1000)
    }
  );
};

const clearProcessingJob = async (jobId?: string) => {
  if (!redis.isOpen || !jobId) {
    return;
  }

  await redis.del(getProcessingMetadataKey(jobId));
};

const markGithubRepoAnalysisFailed = async (projectId: string, lastError: string) => {
  await prisma.githubRepoAnalysis
    .upsert({
      where: { projectId },
      update: {
        status: "FAILED",
        lastError
      },
      create: {
        projectId,
        repoId: "",
        repoName: "unknown",
        status: "FAILED",
        model: "groq/compound-mini",
        lastError
      }
    })
    .catch(() => undefined);
};

const moveJobToDeadLetter = async (
  job: ReturnType<typeof normalizeQueueJob>,
  errorMessage: string
) => {
  await prisma.error
    .update({
      where: { id: job.errorId },
      data: {
        aiStatus: "FAILED",
        aiLastError: errorMessage,
        aiCompletedAt: new Date()
      }
    })
    .catch(() => undefined);
  await releaseRegenerateLock(job.errorId);
  await redis.lPush(
    AI_DEAD_LETTER_QUEUE_KEY,
    JSON.stringify({
      ...job,
      failedAt: new Date().toISOString(),
      error: errorMessage
    })
  );
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
    await releaseRegenerateLock(errorId);
    return;
  }

  if (errorRecord.analysis && errorRecord.aiStatus === "READY") {
    await releaseRegenerateLock(errorId);
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
  const devActive = isUserDevActive(requester);
  const teamActive = Boolean(errorRecord.project.orgId && isOrgTeamActive(errorRecord.project.org));

  if (!proActive) {
    const usageKey = teamActive
      ? `usage:ai:org:${errorRecord.project.orgId}:${currentMonthKey(now)}`
      : !devActive && requester?.email
        ? getFreeEmailUsageRedisKey(requester.email, currentMonthKey(now))
        : `usage:ai:user:${effectiveRequesterId}:${currentMonthKey(now)}`;
    const limit = teamActive
      ? TEAM_MONTHLY_AI_LIMIT
      : devActive
        ? DEV_MONTHLY_AI_LIMIT
        : FREE_MONTHLY_AI_LIMIT;
    const limitMessage = teamActive
      ? "Monthly AI analysis limit reached for this team."
      : devActive
        ? "Monthly AI analysis limit reached for your Dev plan."
        : "Monthly AI analysis limit reached for this account.";

    if (redis.isOpen) {
      if (!teamActive && !devActive && requester?.email) {
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
        await releaseRegenerateLock(errorRecord.id);
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
        : !devActive && requester?.email
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
        await releaseRegenerateLock(errorRecord.id);
        return;
      }
    }
  }

  try {
    const explanation = await generateExplanation({
      message: errorRecord.message,
      stackTrace: errorRecord.stackTrace,
      model: errorRecord.project.aiModel,
      projectId: errorRecord.projectId,
      timeoutMs: AI_GROQ_TIMEOUT_MS
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
    await releaseRegenerateLock(errorRecord.id);

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
    await releaseRegenerateLock(errorRecord.id);

    throw error;
  }
};

const processGithubAnalysisJob = async (job: GithubAnalysisQueueJob) => {
  const normalized = normalizeGithubAnalysisQueueJob(job);
  const usageCost = normalized.usageCost ?? 0;
  const project = await prisma.project.findUnique({
    where: { id: normalized.projectId },
    select: {
      id: true,
      githubRepoId: true,
      githubRepoName: true,
      githubRepoUrl: true,
      aiModel: true,
      orgId: true
    }
  });

  if (!project) {
    return;
  }

  if (!project.githubRepoId || !project.githubRepoName) {
    await markGithubRepoAnalysisFailed(
      normalized.projectId,
      "Link a GitHub repository to this project before running repo analysis."
    );
    return;
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId: normalized.userId
      }
    },
    select: {
      accessTokenEncrypted: true
    }
  });

  if (!connection?.accessTokenEncrypted) {
    await markGithubRepoAnalysisFailed(
      normalized.projectId,
      "Connect GitHub in Settings before running repo analysis."
    );
    return;
  }

  const updateData: any = {
    repoId: project.githubRepoId,
    repoName: project.githubRepoName,
    repoUrl: project.githubRepoUrl,
    model: project.aiModel || "groq/compound-mini",
    lastError: null
  };
  
  if (normalized.analysisType === "graph") {
    updateData.graphStatus = "PROCESSING";
  } else if (normalized.analysisType === "system-design") {
    updateData.systemDesignStatus = "PROCESSING";
  } else {
    updateData.status = "PROCESSING";
  }

  const analysisRecord = await prisma.githubRepoAnalysis.upsert({
    where: { projectId: normalized.projectId },
    update: updateData,
    create: {
      projectId: normalized.projectId,
      repoId: project.githubRepoId!,
      repoName: project.githubRepoName!,
      repoUrl: project.githubRepoUrl,
      status: normalized.analysisType === "report" ? "PROCESSING" : "UNINITIALIZED",
      graphStatus: normalized.analysisType === "graph" ? "PROCESSING" : "UNINITIALIZED",
      systemDesignStatus: normalized.analysisType === "system-design" ? "PROCESSING" : "UNINITIALIZED",
      model: project.aiModel || "groq/compound-mini"
    }
  });

  if (normalized.analysisType === "sync" && normalized.syncPayload) {
    await syncRepoFileChunks({
      projectId: normalized.projectId,
      filesToSync: normalized.syncPayload.filesToSync,
      filesToRemove: normalized.syncPayload.filesToRemove
    });
    return;
  }

  const { report, tree } = await runGithubRepoAnalysis({
    accessTokenEncrypted: connection.accessTokenEncrypted,
    repoFullName: project.githubRepoName!,
    analysisType: normalized.analysisType || "report",
    aiModel: project.aiModel || "groq/compound-mini",
    githubAnalysisId: analysisRecord.id
  });

  const now = new Date();

  const readyUpdateData: any = {
    repoId: project.githubRepoId!,
    repoName: project.githubRepoName!,
    repoUrl: project.githubRepoUrl,
    model: project.aiModel || "groq/compound-mini",
    lastError: null,
    generatedAt: now
  };

  if (normalized.analysisType === "graph") {
    readyUpdateData.graphStatus = "READY";
    readyUpdateData.folderTree = tree as any;
  } else if (normalized.analysisType === "system-design") {
    readyUpdateData.systemDesignStatus = "READY";
    readyUpdateData.systemDesign = report?.systemDesign as any || [];
  } else {
    readyUpdateData.status = "READY";
    readyUpdateData.summary = report?.summary;
    readyUpdateData.architecture = report?.architecture;
    readyUpdateData.runtimeFlow = report?.runtimeFlow;
    readyUpdateData.developmentFlow = report?.developmentFlow;
    readyUpdateData.techStack = report?.techStack;
    readyUpdateData.keyModules = report?.keyModules;
    readyUpdateData.entryPoints = report?.entryPoints;
    readyUpdateData.risks = report?.risks;
    readyUpdateData.onboardingTips = report?.onboardingTips;
  }

  await prisma.$transaction(async (tx) => {
    await tx.githubRepoAnalysis.upsert({
      where: { projectId: normalized.projectId },
      update: readyUpdateData,
      create: {
        projectId: normalized.projectId,
        repoId: project.githubRepoId!,
        repoName: project.githubRepoName!,
        repoUrl: project.githubRepoUrl,
        status: normalized.analysisType === "report" ? "READY" : "UNINITIALIZED",
        graphStatus: normalized.analysisType === "graph" ? "READY" : "UNINITIALIZED",
        systemDesignStatus: normalized.analysisType === "system-design" ? "READY" : "UNINITIALIZED",
        model: project.aiModel || "groq/compound-mini",
        ...readyUpdateData,
        generatedAt: now
      }
    });

    if (normalized.chargeCredits && usageCost > 0) {
      await tx.aiUsageEntry.create({
        data: {
          userId: normalized.userId,
          organizationId: normalized.orgId || null,
          projectId: normalized.projectId,
          kind: "GITHUB_REPO_ANALYSIS",
          amount: usageCost
        }
      });
    }
  });

  if (
    normalized.incrementFreeEmailUsage &&
    normalized.requesterEmail &&
    usageCost > 0
  ) {
    await incrementFreeEmailUsage(normalized.requesterEmail, usageCost, now);
  }
};

const ackQueueJob = async (rawJob: string, job?: AiQueueJob) => {
  if (!redis.isOpen) {
    return;
  }
  await redis.lRem(AI_PROCESSING_QUEUE_KEY, 1, rawJob);
  if (job?.jobId) {
    await clearProcessingJob(job.jobId);
  }
};

const ackGithubAnalysisJob = async (rawJob: string) => {
  if (!redis.isOpen) {
    return;
  }
  await redis.lRem(GITHUB_ANALYSIS_PROCESSING_QUEUE_KEY, 1, rawJob);
};

const moveStaleGithubAnalysisJobsBackToQueue = async () => {
  if (!redis.isOpen) {
    return;
  }

  const inFlightJobs = await redis.lRange(GITHUB_ANALYSIS_PROCESSING_QUEUE_KEY, 0, -1);
  if (!inFlightJobs.length) {
    return;
  }

  for (const rawJob of inFlightJobs) {
    await redis.lRem(GITHUB_ANALYSIS_PROCESSING_QUEUE_KEY, 1, rawJob);
    await redis.rPush(GITHUB_ANALYSIS_QUEUE_KEY, rawJob);
  }

  console.log(
    `Recovered ${inFlightJobs.length} in-flight GitHub analysis job(s) back to the queue.`
  );
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
  await ackQueueJob(rawJob, normalized);

  if (normalized.attempt >= MAX_AI_JOB_ATTEMPTS) {
    await prisma.error.update({
      where: { id: normalized.errorId },
      data: {
        aiStatus: "FAILED",
        aiLastError: error instanceof Error ? error.message : "Unknown worker error",
        aiCompletedAt: new Date()
      }
    }).catch(() => undefined);
    await releaseRegenerateLock(normalized.errorId);
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

  await prisma.error.update({
    where: { id: normalized.errorId },
    data: {
      aiStatus: "PENDING",
      aiLastError: null,
      aiCompletedAt: null
    }
  }).catch(() => undefined);

  await redis.lPush(
    AI_QUEUE_KEY,
    serializeQueueJob({
      ...normalized,
      attempt: normalized.attempt + 1,
      enqueuedAt: new Date().toISOString()
    })
  );
};

const handleFailedGithubAnalysisJob = async (
  rawJob: string,
  job: GithubAnalysisQueueJob,
  error: unknown
) => {
  if (!redis.isOpen) {
    return;
  }

  const normalized = normalizeGithubAnalysisQueueJob(job);
  await ackGithubAnalysisJob(rawJob);

  if (normalized.attempt >= MAX_GITHUB_ANALYSIS_JOB_ATTEMPTS) {
    await markGithubRepoAnalysisFailed(
      normalized.projectId,
      error instanceof Error ? error.message : "GitHub repo analysis failed"
    );
    await redis.lPush(
      GITHUB_ANALYSIS_DEAD_LETTER_QUEUE_KEY,
      JSON.stringify({
        ...normalized,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown worker error"
      })
    );
    return;
  }

  await prisma.githubRepoAnalysis
    .upsert({
      where: { projectId: normalized.projectId },
      update: {
        status: "PENDING",
        lastError: null
      },
      create: {
        projectId: normalized.projectId,
        repoId: "",
        repoName: "unknown",
        status: "PENDING",
        model: "groq/compound-mini"
      }
    })
    .catch(() => undefined);

  await redis.lPush(
    GITHUB_ANALYSIS_QUEUE_KEY,
    serializeGithubAnalysisQueueJob({
      ...normalized,
      attempt: normalized.attempt + 1,
      enqueuedAt: new Date().toISOString()
    })
  );
};

const recoverStaleProcessingJobs = async () => {
  if (!redis.isOpen) {
    return;
  }

  const processingJobs = await redis.lRange(AI_PROCESSING_QUEUE_KEY, 0, -1);
  if (!processingJobs.length) {
    return;
  }

  const normalizedJobs = processingJobs.map((rawJob) => ({
    rawJob,
    job: normalizeQueueJob(parseQueueJob(rawJob))
  }));
  const metadata = await redis.mGet(
    normalizedJobs.map(({ job }) => getProcessingMetadataKey(job.jobId))
  );
  const now = Date.now();

  for (let index = 0; index < normalizedJobs.length; index += 1) {
    const { rawJob, job } = normalizedJobs[index];
    const rawMetadata = metadata[index];
    let startedAtMs = 0;

    if (rawMetadata) {
      try {
        const parsed = JSON.parse(rawMetadata) as { startedAt?: string };
        startedAtMs = parsed.startedAt ? new Date(parsed.startedAt).getTime() : 0;
      } catch {
        startedAtMs = 0;
      }
    }

    if (!startedAtMs && job.enqueuedAt) {
      startedAtMs = new Date(job.enqueuedAt).getTime();
    }

    if (!startedAtMs) {
      const errorState = await prisma.error.findUnique({
        where: { id: job.errorId },
        select: {
          aiRequestedAt: true
        }
      });
      startedAtMs = errorState?.aiRequestedAt ? new Date(errorState.aiRequestedAt).getTime() : 0;
    }

    if (!startedAtMs) {
      continue;
    }

    if (now - startedAtMs <= AI_PROCESSING_STALE_MS) {
      continue;
    }

    await redis.lRem(AI_PROCESSING_QUEUE_KEY, 1, rawJob);
    await clearProcessingJob(job.jobId);
    const nextAttempt = job.attempt + 1;
    const staleErrorMessage = `AI generation timed out after ${AI_PROCESSING_STALE_MS}ms while waiting for the worker to finish.`;

    if (nextAttempt > MAX_AI_JOB_ATTEMPTS) {
      await moveJobToDeadLetter(job, staleErrorMessage);
      console.error(
        `Moved stale AI job ${job.jobId} for error ${job.errorId} to dead-letter queue after ${job.attempt} attempts.`
      );
      continue;
    }

    await prisma.error
      .update({
        where: { id: job.errorId },
        data: {
          aiStatus: "PENDING",
          aiLastError: null,
          aiCompletedAt: null
        }
      })
      .catch(() => undefined);
    await redis.rPush(
      AI_QUEUE_KEY,
      serializeQueueJob({
        ...job,
        attempt: nextAttempt,
        enqueuedAt: new Date().toISOString()
      })
    );
    console.warn(
      `Recovered stale AI job ${job.jobId} for error ${job.errorId}; retrying attempt ${nextAttempt}/${MAX_AI_JOB_ATTEMPTS}.`
    );
  }
};

const recoverOrphanAiRequests = async () => {
  if (!redis.isOpen) {
    return;
  }

  const [pendingJobs, processingJobs] = await Promise.all([
    redis.lRange(AI_QUEUE_KEY, 0, -1),
    redis.lRange(AI_PROCESSING_QUEUE_KEY, 0, -1)
  ]);
  const queuedErrorIds = new Set(pendingJobs.map((rawJob) => parseQueueJob(rawJob).errorId));
  const processingErrorIds = new Set(processingJobs.map((rawJob) => parseQueueJob(rawJob).errorId));
  const staleBefore = new Date(Date.now() - AI_ORPHAN_REQUEST_STALE_MS);

  const staleInFlightErrors = await prisma.error.findMany({
    where: {
      aiStatus: {
        in: ["PENDING", "PROCESSING"]
      },
      aiRequestedAt: {
        lte: staleBefore
      }
    },
    select: {
      id: true,
      aiStatus: true,
      aiRequestedByUserId: true
    },
    take: 200
  });

  for (const staleError of staleInFlightErrors) {
    const inPendingQueue = queuedErrorIds.has(staleError.id);
    const inProcessingQueue = processingErrorIds.has(staleError.id);

    if (inPendingQueue || inProcessingQueue) {
      continue;
    }

    if (staleError.aiStatus === "PROCESSING") {
      await prisma.error
        .update({
          where: { id: staleError.id },
          data: {
            aiStatus: "PENDING",
            aiLastError: null,
            aiCompletedAt: null
          }
        })
        .catch(() => undefined);
      await redis.rPush(
        AI_QUEUE_KEY,
        serializeQueueJob({
          errorId: staleError.id,
          requestedByUserId: staleError.aiRequestedByUserId ?? undefined,
          attempt: 1,
          enqueuedAt: new Date().toISOString()
        })
      );
      console.warn(`Recovered orphan PROCESSING AI request for error ${staleError.id}; requeued.`);
      continue;
    }

    await prisma.error
      .update({
        where: { id: staleError.id },
        data: {
          aiStatus: "FAILED",
          aiLastError:
            "AI request stalled before entering the worker queue. Please generate the solution again.",
          aiCompletedAt: new Date()
        }
      })
      .catch(() => undefined);
    await releaseRegenerateLock(staleError.id);
    console.warn(`Failed orphan PENDING AI request for error ${staleError.id}; not present in any queue.`);
  }
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
  const instanceId = `${process.pid}-${Date.now().toString(36)}`;
  await publishWorkerHeartbeat(instanceId);

  console.log(
    `TraceForge worker started. Waiting for AI jobs (${AI_WORKER_CONCURRENCY}) and repo analysis jobs (${GITHUB_ANALYSIS_WORKER_CONCURRENCY}).`
  );
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

  const aiWorker = createAiWorker<AiQueueJob>(
    async ({ data, id }) => {
      const normalized = normalizeQueueJob({
        ...data,
        jobId: id || data.jobId
      });
      await markProcessingJob(normalized, instanceId);
      try {
        await processError(normalized);
      } finally {
        await clearProcessingJob(normalized.jobId);
      }
    },
    AI_WORKER_CONCURRENCY
  );

  const githubAnalysisWorker = createGithubAnalysisWorker<GithubAnalysisQueueJob>(
    async ({ data }) => {
      await processGithubAnalysisJob(normalizeGithubAnalysisQueueJob(data));
    },
    GITHUB_ANALYSIS_WORKER_CONCURRENCY
  );
  const billingReconciliationWorker = createBillingReconciliationWorker(
    async () => {
      await processBillingReconciliation();
    },
    1
  );
  
  const aiQueueEvents = createAiQueueEvents();
  const githubQueueEvents = createGithubQueueEvents();

  aiWorker.on("failed", async (job, error) => {
    if (!job?.data?.errorId) {
      return;
    }
    if (job.attemptsMade < (job.opts.attempts || 1)) {
      await prisma.error
        .update({
          where: { id: job.data.errorId },
          data: {
            aiStatus: "PENDING",
            aiLastError: null,
            aiCompletedAt: null
          }
        })
        .catch(() => undefined);
      return;
    }

    await prisma.error
      .update({
        where: { id: job.data.errorId },
        data: {
          aiStatus: "FAILED",
          aiLastError: error.message || "Unknown worker error",
          aiCompletedAt: new Date()
        }
      })
      .catch(() => undefined);
    await releaseRegenerateLock(job.data.errorId);
  });

  githubAnalysisWorker.on("failed", async (job, error) => {
    if (!job?.data?.projectId) {
      return;
    }
    if (job.attemptsMade < (job.opts.attempts || 1)) {
      await prisma.githubRepoAnalysis
        .upsert({
          where: { projectId: job.data.projectId },
          update: {
            status: "PENDING",
            lastError: null
          },
          create: {
            projectId: job.data.projectId,
            repoId: "",
            repoName: "unknown",
            status: "PENDING",
            model: "groq/compound-mini"
          }
        })
        .catch(() => undefined);
      return;
    }

    await markGithubRepoAnalysisFailed(
      job.data.projectId,
      error.message || "GitHub repo analysis failed"
    );
  });

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
    await Promise.all([
      aiWorker.close().catch(() => undefined),
      githubAnalysisWorker.close().catch(() => undefined),
      aiQueueEvents.close().catch(() => undefined),
      githubQueueEvents.close().catch(() => undefined)
    ]);
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

  await Promise.all([runCleanupLoop(), aiWorker.waitUntilReady(), githubAnalysisWorker.waitUntilReady()]);
};

start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
