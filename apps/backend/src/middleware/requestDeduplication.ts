import { NextFunction, Request, Response } from "express";
import { redis } from "../db/redis.js";

const areDeduplicationDisabled = () => process.env.DISABLE_REQUEST_DEDUPLICATION === "true";

type DeduplicationOptions = {
  keyPrefix: string;
  ttl?: number; // Time to live for deduplication key in seconds
  keyGenerator?: (req: Request) => string | null;
};

const defaultTTL = 30; // 30 seconds default deduplication window

export const createRequestDeduplication = (options: DeduplicationOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (areDeduplicationDisabled()) {
      return next();
    }

    if (!redis.isOpen) {
      return next();
    }

    const key = options.keyGenerator 
      ? `${options.keyPrefix}:${options.keyGenerator(req)}`
      : `${options.keyPrefix}:${req.method}:${req.path}:${req.user?.id || req.ip}`;

    try {
      // Check if identical request is already in progress
      const existing = await redis.get(key);
      
      if (existing) {
        // Request is in progress, wait for result
        // Poll for the result with a timeout
        const maxWaitTime = 10000; // 10 seconds max wait
        const pollInterval = 50; // 50ms poll interval
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
          const result = await redis.get(key);
          if (result && result.startsWith('RESULT:')) {
            // Result is ready, return it
            const data = result.replace('RESULT:', '');
            try {
              return res.json(JSON.parse(data));
            } catch {
              return res.send(data);
            }
          }
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        // Timeout reached, proceed with normal request
        return next();
      }

      // Mark request as in progress
      await redis.set(key, 'IN_PROGRESS', { EX: options.ttl || defaultTTL });

      // Intercept response to cache the result
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function(data: any) {
        // Cache the result for other identical requests
        redis.set(key, `RESULT:${JSON.stringify(data)}`, { EX: options.ttl || defaultTTL })
          .catch(err => console.error('Failed to cache dedup result:', err));
        
        return originalJson(data);
      };

      res.send = function(data: any) {
        // Cache the result for other identical requests
        redis.set(key, `RESULT:${data}`, { EX: options.ttl || defaultTTL })
          .catch(err => console.error('Failed to cache dedup result:', err));
        
        return originalSend(data);
      };

      // Clean up key if request fails
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          redis.del(key).catch(err => console.error('Failed to cleanup dedup key:', err));
        }
      });

      next();
    } catch (error) {
      console.error('Request deduplication error:', error);
      // Fail open - proceed with normal request on error
      next();
    }
  };
};

export const deduplicateByUser = (
  keyPrefix: string,
  options: Omit<DeduplicationOptions, "keyPrefix" | "keyGenerator"> = {}
) => {
  return createRequestDeduplication({
    keyPrefix,
    ...options,
    keyGenerator: (req) => req.user?.id || req.ip || null
  });
};
