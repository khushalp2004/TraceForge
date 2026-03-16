import "dotenv/config";
import prisma from "./db/prisma.js";
import { connectRedis, redis } from "./db/redis.js";
import { generateExplanation } from "./services/groq.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const processError = async (errorId: string) => {
  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    include: { analysis: true }
  });

  if (!errorRecord) {
    return;
  }

  if (errorRecord.analysis) {
    return;
  }

  const explanation = await generateExplanation({
    message: errorRecord.message,
    stackTrace: errorRecord.stackTrace
  });

  await prisma.errorAnalysis.create({
    data: {
      errorId: errorRecord.id,
      aiExplanation: explanation
    }
  });
};

const start = async () => {
  await prisma.$connect();
  await connectRedis();

  console.log("TraceForge worker started. Waiting for jobs...");

  while (true) {
    try {
      const result = await redis.blPop("ai:queue", 5);
      if (!result) {
        await sleep(1000);
        continue;
      }

      const [, errorId] = result;
      await processError(errorId);
    } catch (error) {
      console.error("Worker error", error);
      await sleep(2000);
    }
  }
};

start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
