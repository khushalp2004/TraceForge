import { NextFunction, Request, Response } from "express";
import { redis } from "../db/redis.js";

type RateLimitOptions = {
  namespace: string;
  windowSeconds: number;
  maxRequests: number;
  message: string;
  keyGenerator?: (req: Request) => string | null;
  failOpen?: boolean;
};

type MemoryRateRecord = {
  count: number;
  resetAt: number;
};

const memoryRateStore = new Map<string, MemoryRateRecord>();

const getRequestIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

const cleanupMemoryRateStore = (now: number) => {
  for (const [key, value] of memoryRateStore.entries()) {
    if (value.resetAt <= now) {
      memoryRateStore.delete(key);
    }
  }
};

const setRateHeaders = (res: Response, maxRequests: number, remaining: number, resetAt: number) => {
  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  res.setHeader("X-RateLimit-Reset", String(Math.max(0, Math.ceil(resetAt / 1000))));
};

const resolveRateLimitKey = (req: Request, options: RateLimitOptions) => {
  const identifier = options.keyGenerator?.(req);
  if (identifier) {
    return `${options.namespace}:${identifier}`;
  }
  return `${options.namespace}:${getRequestIp(req)}`;
};

export const createRateLimit = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = resolveRateLimitKey(req, options);
    const windowMs = options.windowSeconds * 1000;
    const now = Date.now();

    if (redis.isOpen) {
      try {
        const count = await redis.incr(key);
        let ttl = await redis.ttl(key);

        if (count === 1 || ttl < 0) {
          await redis.expire(key, options.windowSeconds);
          ttl = options.windowSeconds;
        }

        const resetAt = now + ttl * 1000;
        const remaining = options.maxRequests - count;
        setRateHeaders(res, options.maxRequests, remaining, resetAt);

        if (count > options.maxRequests) {
          res.setHeader("Retry-After", String(Math.max(1, ttl)));
          return res.status(429).json({ error: options.message });
        }

        return next();
      } catch {
        if (options.failOpen !== false) {
          return next();
        }
      }
    }

    try {
      cleanupMemoryRateStore(now);
      const existing = memoryRateStore.get(key);
      const resetAt = existing && existing.resetAt > now ? existing.resetAt : now + windowMs;
      const nextRecord: MemoryRateRecord =
        existing && existing.resetAt > now
          ? { count: existing.count + 1, resetAt: existing.resetAt }
          : { count: 1, resetAt };

      memoryRateStore.set(key, nextRecord);
      const remaining = options.maxRequests - nextRecord.count;
      setRateHeaders(res, options.maxRequests, remaining, nextRecord.resetAt);

      if (nextRecord.count > options.maxRequests) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((nextRecord.resetAt - now) / 1000)))
        );
        return res.status(429).json({ error: options.message });
      }

      return next();
    } catch {
      if (options.failOpen !== false) {
        return next();
      }

      return res.status(503).json({ error: "Rate limiting is temporarily unavailable" });
    }
  };
};

export const rateLimitByIp = (
  namespace: string,
  options: Omit<RateLimitOptions, "namespace" | "keyGenerator">
) => createRateLimit({ namespace, ...options });

export const rateLimitByUser = (
  namespace: string,
  options: Omit<RateLimitOptions, "namespace" | "keyGenerator">
) =>
  createRateLimit({
    namespace,
    ...options,
    keyGenerator: (req) => req.user?.id || getRequestIp(req)
  });

export const ingestRateLimit = (
  options: Partial<Omit<RateLimitOptions, "namespace" | "message" | "keyGenerator">> = {}
) => {
  const windowSeconds = options.windowSeconds ?? 60;
  const maxRequests = options.maxRequests ?? 120;

  return createRateLimit({
    namespace: "rate:ingest",
    windowSeconds,
    maxRequests,
    message: "Too many error reports, please try again later",
    keyGenerator: (req) => {
      const projectId = req.project?.id ?? "anonymous";
      return `${projectId}:${getRequestIp(req)}`;
    }
  });
};
