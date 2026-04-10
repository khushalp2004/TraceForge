import "dotenv/config";
import { createApp } from "./app.js";
import prisma from "./db/prisma.js";
import { connectRedis, redis } from "./db/redis.js";

const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";

const start = async () => {
  await prisma.$connect();
  await connectRedis();

  const app = createApp();

  const server = app.listen(port, () => {
    if (!isProduction) {
      console.info(`TraceForge API listening on port ${port}`);
    }
  });

  const shutdown = async () => {
    if (!isProduction) {
      console.info("Shutting down TraceForge API...");
    }
    await prisma.$disconnect();
    if (redis.isOpen) {
      await redis.quit();
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

start().catch((err) => {
  console.error("Failed to start TraceForge API", err);
  process.exit(1);
});
