import cluster from "node:cluster";
import { cpus } from "node:os";
import { createApp } from "./app.js";
import { connectRedis } from "./db/redis.js";
import { closeQueues } from "./queue/queues.js";
import prisma from "./db/prisma.js";

// Use WORKER_COUNT from env or default to 2 for multi-container setup
const workerCount = Number(process.env.WORKER_COUNT || 2);

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Forking ${workerCount} workers...`);

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}. Restarting...`);
    cluster.fork();
  });
} else {
  const startServer = async () => {
    await connectRedis();
    const app = createApp();
    const port = Number(process.env.PORT || "3001");
    
    app.listen(port, () => {
      console.log(`Worker ${process.pid} listening on port ${port}`);
    });

    const shutdown = async () => {
      console.log(`Worker ${process.pid} shutting down...`);
      await closeQueues();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  };

  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
