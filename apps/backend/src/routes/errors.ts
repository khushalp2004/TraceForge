import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { limitConcurrentRequests } from "../middleware/concurrency.js";
import { groqRequestRateLimits } from "../middleware/groqRateLimit.js";
import { redis } from "../db/redis.js";
import type { Prisma } from "@prisma/client";
import { getCachedUserOrgIds } from "../utils/access.js";
import { aiGenerateQueue } from "../queue/queues.js";
import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";
import { parseGithubMetadata } from "../utils/integrationConnectionState.js";
import { createGithubIssue, fetchGithubRepos } from "../utils/integrationProviders.js";

export const errorsRouter = Router();

errorsRouter.use(requireAuth);

const AI_REGENERATE_LOCK_TTL_SECONDS = 30;
const AI_WORKER_INSTANCE_SET_KEY = "worker:ai:instances";
const AI_WORKER_HEARTBEAT_PREFIX = "worker:ai:heartbeat:";
const AI_WORKER_HEARTBEAT_STALE_MS = 45_000;
const AI_GROQ_TIMEOUT_MS = Math.max(5_000, Number(process.env.AI_GROQ_TIMEOUT_MS || "45000"));
const AI_PROCESSING_STALE_MS = Math.max(
  AI_GROQ_TIMEOUT_MS + 30_000,
  Number(process.env.AI_PROCESSING_STALE_MS || String(AI_GROQ_TIMEOUT_MS + 30_000))
);
const AI_STALLED_IDLE_MS = Math.max(10_000, Number(process.env.AI_STALLED_IDLE_MS || "10000"));
const getAiRegenerateLockKey = (errorId: string) => `lock:ai:regenerate:${errorId}`;
const regenerateConcurrencyLimit = limitConcurrentRequests({
  namespace: "errors:regenerate",
  maxConcurrent: 250,
  message: "AI regenerate is currently busy. Please try again in a few seconds."
});

const isManualAlertPayload = (payload: Prisma.JsonValue | null | undefined) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return (payload as Record<string, unknown>).source === "manual-alert-trigger";
};

const hasManualAlertSource = (
  events: Array<{
    payload: Prisma.JsonValue | null;
  }>
) => events.some((event) => isManualAlertPayload(event.payload));

const hasHealthyAiWorker = async () => {
  if (!redis.isOpen) {
    return false;
  }

  const instanceIds = await redis.sMembers(AI_WORKER_INSTANCE_SET_KEY);
  if (!instanceIds.length) {
    return false;
  }

  const heartbeats = await redis.mGet(
    instanceIds.map((instanceId) => `${AI_WORKER_HEARTBEAT_PREFIX}${instanceId}`)
  );
  const now = Date.now();

  return heartbeats.some((rawHeartbeat) => {
    if (!rawHeartbeat) {
      return false;
    }

    try {
      const parsed = JSON.parse(rawHeartbeat) as { updatedAt?: string };
      if (!parsed.updatedAt) {
        return false;
      }

      return now - new Date(parsed.updatedAt).getTime() <= AI_WORKER_HEARTBEAT_STALE_MS;
    } catch {
      return false;
    }
  });
};

const isAiInFlight = (status: "PENDING" | "PROCESSING" | "READY" | "FAILED") =>
  status === "PENDING" || status === "PROCESSING";
const hasAiRequestTimestamp = (value?: string | Date | null) => Boolean(value);

const shouldFailStaleAiRequest = (
  errorRecord: {
    aiStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    aiRequestedAt?: string | Date | null;
  },
  queueState: Awaited<ReturnType<typeof getAiQueueState>>
) => {
  if (!isAiInFlight(errorRecord.aiStatus) || !errorRecord.aiRequestedAt) {
    return false;
  }

  const requestedAtMs = new Date(errorRecord.aiRequestedAt).getTime();
  if (!Number.isFinite(requestedAtMs)) {
    return false;
  }

  const ageMs = Date.now() - requestedAtMs;

  if (!queueState.available || queueState.state === "idle") {
    return ageMs >= AI_STALLED_IDLE_MS;
  }

  if (queueState.state === "processing") {
    return ageMs >= AI_PROCESSING_STALE_MS;
  }

  return false;
};

const failStaleAiRequest = async (errorId: string, reason: string) => {
  await prisma.error.update({
    where: { id: errorId },
    data: {
      aiStatus: "FAILED",
      aiLastError: reason,
      aiCompletedAt: new Date()
    }
  });
  if (redis.isOpen) {
    await redis.del(getAiRegenerateLockKey(errorId)).catch(() => undefined);
  }
};

const reconcileAiRequestState = async <
  T extends {
    id: string;
    aiStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    aiRequestedAt?: string | Date | null;
    aiLastError?: string | null;
    aiCompletedAt?: string | Date | null;
  }
>(
  errorRecord: T
) => {
  if (!isAiInFlight(errorRecord.aiStatus)) {
    return { errorRecord, queue: null as Awaited<ReturnType<typeof getAiQueueState>> | null };
  }

  const queue = await getAiQueueState(errorRecord.id);
  if (!shouldFailStaleAiRequest(errorRecord, queue)) {
    return { errorRecord, queue };
  }

  const aiLastError =
    queue.state === "processing"
      ? "AI generation timed out while processing. Please generate the solution again."
      : "AI request stalled before the worker picked it up. Please generate the solution again.";

  await failStaleAiRequest(errorRecord.id, aiLastError);

  return {
    errorRecord: {
      ...errorRecord,
      aiStatus: "FAILED" as const,
      aiLastError,
      aiCompletedAt: new Date().toISOString()
    },
    queue: null
  };
};

const getAiQueueState = async (errorId: string) => {
  if (!redis.isOpen) {
    return {
      available: false,
      state: "unavailable" as const,
      reason: "redis_unavailable" as const,
      queuePosition: null,
      pendingCount: 0,
      processingCount: 0
    };
  }

  const [
    counts,
    waitingJobs,
    activeJobs
  ] = await Promise.all([
    aiGenerateQueue.getJobCounts("waiting", "active", "delayed", "prioritized"),
    aiGenerateQueue.getJobs(["waiting", "prioritized", "delayed"], 0, 500, true),
    aiGenerateQueue.getJobs(["active"], 0, 200, true)
  ]);
  const workerHealthy = await hasHealthyAiWorker();
  const pendingCount =
    (counts.waiting || 0) + (counts.delayed || 0) + (counts.prioritized || 0);
  const processingCount = counts.active || 0;
  if (!workerHealthy) {
    return {
      available: false,
      state: "unavailable" as const,
      reason: "worker_unhealthy" as const,
      queuePosition: null,
      pendingCount,
      processingCount
    };
  }

  const pendingIndex = waitingJobs.findIndex(
    (job) => (job.data as { errorId?: string } | undefined)?.errorId === errorId
  );
  const processingIndex = activeJobs.findIndex(
    (job) => (job.data as { errorId?: string } | undefined)?.errorId === errorId
  );

  if (processingIndex >= 0) {
    return {
      available: true,
      state: "processing" as const,
      reason: null,
      queuePosition: 0,
      pendingCount,
      processingCount
    };
  }

  if (pendingIndex >= 0) {
    return {
      available: true,
      state: "queued" as const,
      reason: null,
      queuePosition: pendingIndex + 1,
      pendingCount,
      processingCount
    };
  }

  return {
    available: true,
    state: "idle" as const,
    reason: null,
    queuePosition: null,
    pendingCount,
    processingCount
  };
};

errorsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, q, env, sort, severity, page, pageSize } = req.query as {
    projectId?: string;
    q?: string;
    env?: string;
    severity?: "critical" | "warning" | "info";
    sort?: "lastSeen" | "count";
    page?: string;
    pageSize?: string;
  };
  const archivedOnly = req.query.archivedOnly === "true";
  const currentPage = Math.max(1, Number.parseInt(page || "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, Number.parseInt(pageSize || "5", 10) || 5));

  const orgIds = await getCachedUserOrgIds(userId);

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    select: { id: true }
  });

  const allowedProjectIds = new Set(projects.map((p) => p.id));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const baseWhere: Prisma.ErrorWhereInput = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const andConditions: Prisma.ErrorWhereInput[] = [
    baseWhere,
    {
      archivedAt: archivedOnly ? { not: null } : null
    }
  ];

  if (q) {
    andConditions.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { stackTrace: { contains: q, mode: "insensitive" } },
        { analysis: { is: { aiExplanation: { contains: q, mode: "insensitive" } } } },
        { project: { name: { contains: q, mode: "insensitive" } } }
      ]
    });
  }

  if (env) {
    andConditions.push({
      events: {
        some: {
          environment: env
        }
      }
    });
  }

  if (severity === "critical") {
    andConditions.push({
      OR: [
        { message: { contains: "null", mode: "insensitive" } },
        { message: { contains: "undefined", mode: "insensitive" } },
        { message: { contains: "typeerror", mode: "insensitive" } }
      ]
    });
  }

  if (severity === "warning") {
    andConditions.push({
      AND: [
        {
          OR: [
            { message: { contains: "timeout", mode: "insensitive" } },
            { message: { contains: "network", mode: "insensitive" } },
            { message: { contains: "rate", mode: "insensitive" } }
          ]
        },
        {
          NOT: {
            OR: [
              { message: { contains: "null", mode: "insensitive" } },
              { message: { contains: "undefined", mode: "insensitive" } },
              { message: { contains: "typeerror", mode: "insensitive" } }
            ]
          }
        }
      ]
    });
  }

  if (severity === "info") {
    andConditions.push({
      NOT: {
        OR: [
          { message: { contains: "null", mode: "insensitive" } },
          { message: { contains: "undefined", mode: "insensitive" } },
          { message: { contains: "typeerror", mode: "insensitive" } },
          { message: { contains: "timeout", mode: "insensitive" } },
          { message: { contains: "network", mode: "insensitive" } },
          { message: { contains: "rate", mode: "insensitive" } }
        ]
      }
    });
  }

  const where: Prisma.ErrorWhereInput = { AND: andConditions };

  const orderBy: Prisma.ErrorOrderByWithRelationInput =
    sort === "count" ? { count: "desc" } : { lastSeen: "desc" };

  const [errors, total] = await Promise.all([
    prisma.error.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        projectId: true,
        message: true,
        stackTrace: true,
        count: true,
        lastSeen: true,
        archivedAt: true,
        aiStatus: true,
        aiLastError: true,
        aiRequestedAt: true,
        analysis: true,
        events: {
          select: {
            payload: true
          },
          orderBy: {
            timestamp: "desc"
          },
          take: 10
        }
      }
    }),
    prisma.error.count({ where })
  ]);

  return res.json({
    errors: await Promise.all(
      errors.map(async (errorRecord) => {
        const { errorRecord: reconciledError, queue } = await reconcileAiRequestState(errorRecord);

        return {
          ...reconciledError,
          isManualAlertIssue: hasManualAlertSource(errorRecord.events),
          queue
        };
      })
    ),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage))
    }
  });
});

errorsRouter.get("/:id", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      message: true,
      stackTrace: true,
      count: true,
      firstSeen: true,
      lastSeen: true,
      archivedAt: true,
      aiStatus: true,
      aiLastError: true,
      aiRequestedAt: true,
      aiCompletedAt: true,
      analysis: {
        select: {
          aiExplanation: true,
          suggestedFix: true
        }
      },
      project: {
        select: {
          id: true,
          userId: true,
          orgId: true,
          archivedAt: true,
          name: true,
          githubRepoId: true,
          githubRepoName: true,
          githubRepoUrl: true
        }
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 10
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const { errorRecord: reconciledError, queue } = await reconcileAiRequestState(errorRecord);

  return res.json({
    error: {
      ...reconciledError,
      queue,
      isManualAlertIssue: hasManualAlertSource(errorRecord.events)
    }
  });
});

errorsRouter.post("/:id/github-issue", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;
  const { repoId, title, body } = req.body as {
    repoId?: string;
    title?: string;
    body?: string;
  };

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      message: true,
      stackTrace: true,
      count: true,
      lastSeen: true,
      archivedAt: true,
      analysis: {
        select: {
          aiExplanation: true,
          suggestedFix: true
        }
      },
      project: {
        select: {
          id: true,
          name: true,
          userId: true,
          orgId: true,
          archivedAt: true,
          githubRepoId: true,
          githubRepoName: true,
          githubRepoUrl: true
        }
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 3
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt || errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Connect GitHub in Settings first" });
  }

  const metadata = parseGithubMetadata(connection.metadata);
  if (!metadata.selectedRepoIds?.length) {
    return res.status(400).json({ error: "Choose at least one GitHub repository in Settings first" });
  }

  try {
    const accessToken = decryptIntegrationSecret(connection.accessTokenEncrypted);
    const repos = await fetchGithubRepos(accessToken);
    const fallbackRepoId = errorRecord.project.githubRepoId || "";
    const resolvedRepoId =
      typeof repoId === "string" && repoId.trim() ? repoId.trim() : fallbackRepoId;

    if (!resolvedRepoId) {
      return res.status(400).json({ error: "repoId is required" });
    }

    const repo = repos.find(
      (entry) => entry.id === resolvedRepoId && metadata.selectedRepoIds?.includes(entry.id)
    );

    if (!repo) {
      return res.status(404).json({ error: "Selected GitHub repository is not available" });
    }

    const githubIssue = await createGithubIssue({
      accessToken,
      repoFullName: repo.fullName,
      title:
        typeof title === "string" && title.trim()
          ? title.trim().slice(0, 240)
          : `[TraceForge] ${errorRecord.message}`.slice(0, 240),
      body:
        typeof body === "string" && body.trim()
          ? body.trim()
          : [
              `TraceForge issue: ${errorRecord.message}`,
              "",
              `Project: ${errorRecord.project.name}`,
              `Occurrences: ${errorRecord.count}`,
              `Last seen: ${errorRecord.lastSeen.toISOString()}`,
              "",
              "```",
              errorRecord.stackTrace,
              "```"
            ].join("\n")
    });

    return res.json({
      ok: true,
      issue: {
        id: githubIssue.id,
        number: githubIssue.number,
        title: githubIssue.title,
        url: githubIssue.url,
        repoFullName: repo.fullName
      }
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create GitHub issue"
    });
  }
});

errorsRouter.post("/:id/regenerate", ...groqRequestRateLimits, regenerateConcurrencyLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      aiStatus: true,
      aiRequestedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      },
      events: {
        select: {
          payload: true
        },
        orderBy: {
          timestamp: "desc"
        },
        take: 10
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (hasManualAlertSource(errorRecord.events)) {
    return res
      .status(400)
      .json({ error: "AI solution is not available for manual alert issues" });
  }

  if (!redis.isOpen) {
    await prisma.error.update({
      where: { id: errorId },
      data: {
        aiStatus: "FAILED",
        aiLastError: "AI worker queue is unavailable.",
        aiRequestedAt: new Date(),
        aiCompletedAt: null
      }
    });

    return res.status(503).json({ error: "AI worker queue is unavailable. Try again shortly." });
  }

  if (!(await hasHealthyAiWorker())) {
    await prisma.error.update({
      where: { id: errorId },
      data: {
        aiStatus: "FAILED",
        aiLastError: "AI worker is not currently available.",
        aiRequestedAt: new Date(),
        aiCompletedAt: new Date()
      }
    });

    return res.status(503).json({ error: "AI worker is not currently available. Try again shortly." });
  }

  if (isAiInFlight(errorRecord.aiStatus) && hasAiRequestTimestamp(errorRecord.aiRequestedAt)) {
    const queue = await getAiQueueState(errorId);
    if (shouldFailStaleAiRequest(errorRecord, queue)) {
      await failStaleAiRequest(
        errorId,
        queue.state === "processing"
          ? "AI generation timed out while processing. Please generate the solution again."
          : "AI request stalled before the worker picked it up. Please generate the solution again."
      );
    } else {
      return res.status(202).json({
        status: "queued",
        deduped: true,
        queue
      });
    }
  }

  const lockKey = getAiRegenerateLockKey(errorId);
  const lockAcquired = await redis.set(lockKey, userId, {
    NX: true,
    EX: AI_REGENERATE_LOCK_TTL_SECONDS
  });

  if (!lockAcquired) {
    const queue = await getAiQueueState(errorId);
    if (shouldFailStaleAiRequest(errorRecord, queue)) {
      await failStaleAiRequest(
        errorId,
        queue.state === "processing"
          ? "AI generation timed out while processing. Please generate the solution again."
          : "AI request stalled before the worker picked it up. Please generate the solution again."
      );
      const refreshedLock = await redis.set(lockKey, userId, {
        NX: true,
        EX: AI_REGENERATE_LOCK_TTL_SECONDS
      });
      if (!refreshedLock) {
        return res.status(202).json({
          status: "queued",
          deduped: true,
          queue: await getAiQueueState(errorId)
        });
      }
    } else {
      return res.status(202).json({
        status: "queued",
        deduped: true,
        queue
      });
    }
  }

  try {
    // Add to queue BEFORE database transaction to ensure consistency
    // If queue add fails, we don't mark the error as PENDING
    let job;
    try {
      job = await aiGenerateQueue.add(
        "generate-error-solution",
        {
          errorId,
          requestedByUserId: userId,
          enqueuedAt: new Date().toISOString()
        },
        {
          attempts: Number(process.env.AI_WORKER_MAX_ATTEMPTS || "3"),
          backoff: {
            type: "exponential",
            delay: 2_000
          },
          removeOnComplete: 1000,
          removeOnFail: 3000
        }
      );
    } catch (queueError) {
      console.error("Failed to add job to queue:", queueError);
      await prisma.error.update({
        where: { id: errorId },
        data: {
          aiStatus: "FAILED",
          aiLastError: "Failed to queue job for processing. Please try again.",
          aiRequestedAt: new Date(),
          aiCompletedAt: new Date()
        }
      });
      await redis.del(lockKey);
      return res.status(503).json({ error: "Failed to queue job. Try again shortly." });
    }

    if (!job) {
      throw new Error("Failed to add job to queue");
    }

    // Now update database after queue add succeeds
    await prisma.$transaction([
      prisma.errorAnalysis.deleteMany({
        where: { errorId }
      }),
      prisma.error.update({
        where: { id: errorId },
        data: {
          aiStatus: "PENDING",
          aiLastError: null,
          aiRequestedAt: new Date(),
          aiRequestedByUserId: userId,
          aiCompletedAt: null
        }
      })
    ]);

    return res.status(202).json({
      status: "queued",
      deduped: false,
      queue: await getAiQueueState(errorId)
    });
  } catch (error) {
    await redis.del(lockKey);
    // If queue add failed, the error is not in PENDING state, which is correct
    // If DB update failed, the job is already queued and will be picked up by worker
    throw error;
  }
});

errorsRouter.post("/:id/archive", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_archived" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: new Date() }
  });

  return res.status(200).json({ status: "archived" });
});

errorsRouter.post("/:id/restore", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_active" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Project is archived" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: null }
  });

  return res.status(200).json({ status: "restored" });
});

errorsRouter.delete("/:id", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!errorRecord.archivedAt) {
    return res.status(400).json({ error: "Archive the issue before deleting it permanently" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.$transaction([
    prisma.alertDelivery.deleteMany({ where: { errorId } }),
    prisma.errorAnalysis.deleteMany({ where: { errorId } }),
    prisma.errorEvent.deleteMany({ where: { errorId } }),
    prisma.error.delete({ where: { id: errorId } })
  ]);

  return res.status(200).json({ status: "deleted" });
});
