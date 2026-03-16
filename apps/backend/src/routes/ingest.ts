import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireProjectApiKey } from "../middleware/apiKey.js";
import { hashErrorSignature } from "../utils/hash.js";
import { redis } from "../db/redis.js";
import { ingestRateLimit } from "../middleware/rateLimit.js";

export const ingestRouter = Router();

ingestRouter.post("/", requireProjectApiKey, ingestRateLimit(), async (req, res) => {
  const { message, stackTrace, environment, payload } = req.body as {
    message?: string;
    stackTrace?: string;
    environment?: string;
    payload?: Record<string, unknown>;
  };

  if (!message || !stackTrace) {
    return res.status(400).json({ error: "message and stackTrace are required" });
  }

  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const hash = hashErrorSignature(message, stackTrace);

  const now = new Date();

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

  await prisma.errorEvent.create({
    data: {
      errorId: errorRecord.id,
      timestamp: now,
      environment,
      payload: payload ?? undefined
    }
  });

  return res.status(202).json({
    status: existing ? "existing" : "new",
    errorId: errorRecord.id
  });
});
