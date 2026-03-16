import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

export const redis = createClient({ url: redisUrl });

redis.on("error", (err) => {
  console.error("Redis client error", err);
});

export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};
