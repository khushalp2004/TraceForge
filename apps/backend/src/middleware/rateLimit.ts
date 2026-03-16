import { NextFunction, Request, Response } from "express";
import { redis } from "../db/redis.js";

type RateLimitOptions = {
  windowSeconds: number;
  maxRequests: number;
};

const defaultOptions: RateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 120
};

export const ingestRateLimit = (options: Partial<RateLimitOptions> = {}) => {
  const { windowSeconds, maxRequests } = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    // If Redis is not available, skip rate limiting rather than breaking ingest.
    if (!redis.isOpen) {
      return next();
    }

    try {
      const projectId = req.project?.id ?? "anonymous";
      const ip = (req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString();
      const key = `rate:ingest:${projectId}:${ip}`;

      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        return res.status(429).json({
          error: "Too many error reports, please try again later"
        });
      }

      return next();
    } catch {
      // Fail open on Redis errors to avoid blocking ingest.
      return next();
    }
  };
};

