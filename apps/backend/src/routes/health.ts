import { Router } from "express";
import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";

export const healthRouter = Router();
const WORKER_HEARTBEAT_SET_KEY = "worker:ai:instances";
const WORKER_HEARTBEAT_PREFIX = "worker:ai:heartbeat:";
const WORKER_HEARTBEAT_STALE_MS = 45_000;

const getWorkerDiagnostics = async () => {
  if (!redis.isOpen) {
    return {
      healthy: false,
      instances: [],
      queue: {
        pending: 0,
        processing: 0,
        deadLetter: 0
      }
    };
  }

  const [instanceIds, pending, processing, deadLetter] = await Promise.all([
    redis.sMembers(WORKER_HEARTBEAT_SET_KEY),
    redis.lLen("ai:queue"),
    redis.lLen("ai:processing"),
    redis.lLen("ai:dead")
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

  return {
    healthy: instances.some((instance) => instance?.healthy),
    instances,
    queue: {
      pending,
      processing,
      deadLetter
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
