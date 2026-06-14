import "dotenv/config";
import { createApp } from "./app.js";
import prisma from "./db/prisma.js";
import { connectRedis, redis, redisPublisher, redisSubscriber } from "./db/redis.js";
import { closeQueues, billingReconciliationQueue } from "./queue/queues.js";

const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";

const start = async () => {
  await prisma.$connect();
  await connectRedis();

  const app = createApp();

  await billingReconciliationQueue.add(
    "reconcile",
    {},
    {
      repeat: { pattern: "0 2 * * *" },
      jobId: "billing-reconciliation-job"
    }
  );

  const server = app.listen(port, () => {
    if (!isProduction) {
      console.info(`TraceForge API listening on port ${port}`);
    }
  });

  const shutdown = async () => {
    if (!isProduction) {
      console.info("Shutting down TraceForge API...");
    }
    await closeQueues().catch(() => undefined);
    await prisma.$disconnect();
    await Promise.all([
      redis.isOpen ? redis.quit().catch(() => undefined) : Promise.resolve(),
      redisPublisher.isOpen ? redisPublisher.quit().catch(() => undefined) : Promise.resolve(),
      redisSubscriber.isOpen ? redisSubscriber.quit().catch(() => undefined) : Promise.resolve()
    ]);
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

start().catch((err) => {
  console.error("Failed to start TraceForge API", err);
  process.exit(1);
});
