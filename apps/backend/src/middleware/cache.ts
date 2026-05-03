import { Request, Response, NextFunction } from "express";
import { redis } from "../db/redis.js";

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  skipCache?: (req: Request) => boolean;
}

const DEFAULT_TTL = 60;

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = DEFAULT_TTL, keyPrefix = "cache", skipCache } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redis.isOpen || (skipCache && skipCache(req))) {
      return next();
    }

    const cacheKey = `${keyPrefix}:${req.method}:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(cached));
      }

      res.setHeader("X-Cache", "MISS");
      
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        if (res.statusCode === 200) {
          redis.set(cacheKey, JSON.stringify(data), { EX: ttl }).catch(() => {});
        }
        return originalJson(data);
      };

      next();
    } catch {
      next();
    }
  };
};

export const invalidateCache = async (pattern: string) => {
  if (!redis.isOpen) return;
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // Ignore cache invalidation errors
  }
};
