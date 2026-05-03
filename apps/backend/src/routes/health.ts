import { Router } from "express";
import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { getRequestMetricsSnapshot } from "../utils/requestMetrics.js";
import { getQueryMetricsSnapshot } from "../utils/queryMetrics.js";
import { aiGenerateQueue, githubAnalysisQueue } from "../queue/queues.js";

export const healthRouter = Router();
const WORKER_HEARTBEAT_SET_KEY = "worker:ai:instances";
const WORKER_HEARTBEAT_PREFIX = "worker:ai:heartbeat:";
const WORKER_HEARTBEAT_STALE_MS = 45_000;
const AI_GROQ_TIMEOUT_MS = Math.max(5_000, Number(process.env.AI_GROQ_TIMEOUT_MS || "45000"));
const AI_PROCESSING_STALE_MS = Math.max(AI_GROQ_TIMEOUT_MS + 30_000, Number(process.env.AI_PROCESSING_STALE_MS || String(AI_GROQ_TIMEOUT_MS + 30_000)));

const getQueueLagSnapshot = async (queue: typeof aiGenerateQueue) => {
  const [counts, waitingJobs, activeJobs] = await Promise.all([
    queue.getJobCounts("waiting", "active", "delayed", "failed"),
    queue.getJobs(["waiting", "delayed", "prioritized"], 0, 200, true),
    queue.getJobs(["active"], 0, 200, true)
  ]);
  const now = Date.now();

  const oldestWaitingAgeMs = waitingJobs.length
    ? Math.max(
        ...waitingJobs
          .map((job) => {
            const ts = typeof job.timestamp === "number" ? job.timestamp : 0;
            return ts > 0 ? now - ts : 0;
          })
          .filter((age) => Number.isFinite(age))
      )
    : null;
  const oldestActiveAgeMs = activeJobs.length
    ? Math.max(
        ...activeJobs
          .map((job) => {
            const processedOn = typeof job.processedOn === "number" ? job.processedOn : 0;
            return processedOn > 0 ? now - processedOn : 0;
          })
          .filter((age) => Number.isFinite(age))
      )
    : null;

  return {
    pending: (counts.waiting || 0) + (counts.delayed || 0) + (counts.prioritized || 0),
    processing: counts.active || 0,
    failed: counts.failed || 0,
    oldestPendingAgeMs: oldestWaitingAgeMs,
    oldestProcessingAgeMs: oldestActiveAgeMs
  };
};

const getWorkerDiagnostics = async () => {
  if (!redis.isOpen) {
    return {
      healthy: false,
      instances: [],
      queue: {
        ai: {
          pending: 0,
          processing: 0,
          failed: 0,
          oldestPendingAgeMs: null,
          oldestProcessingAgeMs: null
        },
        githubAnalysis: {
          pending: 0,
          processing: 0,
          failed: 0,
          oldestPendingAgeMs: null,
          oldestProcessingAgeMs: null
        }
      }
    };
  }

  const [instanceIds, aiQueue, githubQueue] = await Promise.all([
    redis.sMembers(WORKER_HEARTBEAT_SET_KEY),
    getQueueLagSnapshot(aiGenerateQueue),
    getQueueLagSnapshot(githubAnalysisQueue)
  ]);

  const heartbeats = instanceIds.length
    ? await redis.mGet(instanceIds.map((id) => `${WORKER_HEARTBEAT_PREFIX}${id}`))
    : [];
  const now = Date.now();
  const instances = heartbeats
    .map((raw, index) => {
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as {
          instanceId: string;
          updatedAt: string;
          concurrency: number;
          pid: number;
        };
        const ageMs = Math.max(0, now - new Date(parsed.updatedAt).getTime());
        return {
          instanceId: parsed.instanceId,
          updatedAt: parsed.updatedAt,
          pid: parsed.pid,
          concurrency: parsed.concurrency,
          ageMs,
          healthy: ageMs <= WORKER_HEARTBEAT_STALE_MS
        };
      } catch {
        return {
          instanceId: instanceIds[index],
          updatedAt: null,
          pid: null,
          concurrency: null,
          ageMs: null,
          healthy: false
        };
      }
    })
    .filter(Boolean);

  const staleProcessing =
    (aiQueue.oldestProcessingAgeMs || 0) > AI_PROCESSING_STALE_MS ? 1 : 0;

  return {
    healthy: instances.some((instance) => instance?.healthy),
    instances,
    queue: {
      ai: {
        ...aiQueue,
        staleProcessing
      },
      githubAnalysis: githubQueue
    }
  };
};

healthRouter.get("/live", (_req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const checks = {
    database: false,
    redis: false
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    checks.redis = redis.isOpen && (await redis.ping()) === "PONG";
  } catch {
    checks.redis = false;
  }

  const ready = checks.database && checks.redis;

  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    checks,
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/diagnostics", async (_req, res) => {
  const [worker, readyChecks] = await Promise.all([
    getWorkerDiagnostics(),
    (async () => {
      let database = false;
      let redisHealthy = false;

      try {
        await prisma.$queryRaw`SELECT 1`;
        database = true;
      } catch {
        database = false;
      }

      try {
        redisHealthy = redis.isOpen && (await redis.ping()) === "PONG";
      } catch {
        redisHealthy = false;
      }

      return { database, redis: redisHealthy };
    })()
  ]);

  const overallStatus =
    readyChecks.database && readyChecks.redis
      ? worker.healthy
        ? "ok"
        : "degraded"
      : "degraded";

  res.status(overallStatus === "ok" ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    checks: readyChecks,
    worker
  });
});

healthRouter.get("/performance", async (_req, res) => {
  const routes = getRequestMetricsSnapshot();
  const queries = getQueryMetricsSnapshot();
  const [aiQueue, githubQueue] = await Promise.all([
    getQueueLagSnapshot(aiGenerateQueue),
    getQueueLagSnapshot(githubAnalysisQueue)
  ]);

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    routes: routes.slice(0, 25),
    queries: queries.slice(0, 25),
    queues: {
      ai: aiQueue,
      githubAnalysis: githubQueue
    }
  });
});

healthRouter.get("/", async (_req, res) => {
  const [worker, redisHealthy] = await Promise.all([
    getWorkerDiagnostics(),
    (async () => {
      try {
        return redis.isOpen && (await redis.ping()) === "PONG";
      } catch {
        return false;
      }
    })()
  ]);

  const status = redisHealthy && worker.healthy ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    redis: redisHealthy ? "ok" : "down",
    worker: worker.healthy ? "ok" : "degraded",
    queue: worker.queue
  });
});
