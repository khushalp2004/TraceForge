import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireProjectApiKey } from "../middleware/apiKey.js";
import { hashErrorSignature } from "../utils/hash.js";
import { redis } from "../db/redis.js";
import { ingestRateLimit } from "../middleware/rateLimit.js";
import { evaluateAlertRulesForError } from "../utils/alerts.js";

export const ingestRouter = Router();

const currentMonthKey = (now: Date) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

ingestRouter.post("/setup", requireProjectApiKey, async (req, res) => {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { configuredAt: true }
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      configuredAt: project?.configuredAt ?? now,
      lastConfiguredAt: now
    }
  });

  return res.json({ status: "configured", configuredAt: now.toISOString() });
});

ingestRouter.post("/", requireProjectApiKey, ingestRateLimit(), async (req, res) => {
  const { message, stackTrace, environment, payload, release } = req.body as {
    message?: string;
    stackTrace?: string;
    environment?: string;
    payload?: Record<string, unknown>;
    release?: string;
  };

  if (!message || !stackTrace) {
    return res.status(400).json({ error: "message and stackTrace are required" });
  }

  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ownerId = req.project?.userId;
  if (!ownerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const hash = hashErrorSignature(message, stackTrace);
  const payloadRelease =
    typeof payload?.release === "string" && payload.release.trim()
      ? payload.release.trim()
      : null;
  const releaseVersion =
    typeof release === "string" && release.trim() ? release.trim() : payloadRelease;

  const now = new Date();

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { plan: true, planExpiresAt: true }
  });

  const proActive =
    owner?.plan === "PRO" && (!owner.planExpiresAt || owner.planExpiresAt.getTime() > now.getTime());

  if (!proActive) {
    const limit = 1000;
    const usageKey = `usage:errors:${ownerId}:${currentMonthKey(now)}`;

    if (redis.isOpen) {
      const current = await redis.incr(usageKey);
      if (current === 1) {
        await redis.expire(usageKey, 60 * 60 * 24 * 45);
      }

      if (current > limit) {
        await redis.decr(usageKey);
        return res.status(402).json({
          error: "Free plan monthly error limit reached. Upgrade to Pro to continue ingesting."
        });
      }
    } else {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const used = await prisma.errorEvent.count({
        where: {
          timestamp: { gte: monthStart },
          error: {
            project: {
              userId: ownerId
            }
          }
        }
      });

      if (used >= limit) {
        return res.status(402).json({
          error: "Free plan monthly error limit reached. Upgrade to Pro to continue ingesting."
        });
      }
    }
  }

  const existing = await prisma.error.findUnique({
    where: {
      projectId_hash: {
        projectId,
        hash
      }
    }
  });

  let errorRecord;

  if (existing) {
    errorRecord = await prisma.error.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        lastSeen: now
      }
    });
  } else {
    errorRecord = await prisma.error.create({
      data: {
        projectId,
        message,
        stackTrace,
        hash,
        firstSeen: now,
        lastSeen: now,
        count: 1
      }
    });

    // Enqueue for AI analysis
    if (redis.isOpen) {
      await redis.lPush("ai:queue", errorRecord.id);
    }
  }

  let releaseRecord = null;

  if (releaseVersion) {
    releaseRecord = await prisma.release.upsert({
      where: {
        projectId_version: {
          projectId,
          version: releaseVersion
        }
      },
      update: {
        environment: environment ?? undefined
      },
      create: {
        projectId,
        version: releaseVersion,
        environment,
        source: "INGEST",
        releasedAt: now
      }
    });
  }

  await prisma.errorEvent.create({
    data: {
      errorId: errorRecord.id,
      releaseId: releaseRecord?.id,
      timestamp: now,
      environment,
      payload:
        payload || releaseVersion
          ? {
              ...(payload ?? {}),
              ...(releaseVersion ? { release: releaseVersion } : {})
            }
          : undefined
    }
  });

  await evaluateAlertRulesForError({
    errorId: errorRecord.id,
    projectId,
    environment,
    message,
    count: errorRecord.count
  });

  return res.status(202).json({
    status: existing ? "existing" : "new",
    errorId: errorRecord.id
  });
});
