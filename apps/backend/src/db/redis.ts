import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

export const redis = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    lazyConnect: true
  }
});
export const redisPublisher = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    lazyConnect: true
  }
});
export const redisSubscriber = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    lazyConnect: true
  }
});

redis.on("error", (err) => {
  console.error("Redis client error", err);
});
redisPublisher.on("error", (err) => {
  console.error("Redis publisher error", err);
});
redisSubscriber.on("error", (err) => {
  console.error("Redis subscriber error", err);
});

export const connectRedis = async () => {
  await Promise.all([
    redis.isOpen ? Promise.resolve() : redis.connect(),
    redisPublisher.isOpen ? Promise.resolve() : redisPublisher.connect(),
    redisSubscriber.isOpen ? Promise.resolve() : redisSubscriber.connect()
  ]);
};
