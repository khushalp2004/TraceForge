import { URL } from "node:url";
import { QueueEvents, Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

const toBullConnection = () => {
  const parsed = new URL(redisUrl);
  const tls =
    parsed.protocol === "rediss:"
      ? {
          rejectUnauthorized: false
        }
      : undefined;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls
  };
};

export const bullConnection = toBullConnection();

export const AI_GENERATE_QUEUE = "ai-generate";
export const GITHUB_ANALYSIS_QUEUE = "github-repo-analysis";

export const createAiWorker = <T>(processor: (job: { data: T; id?: string }) => Promise<void>, concurrency: number) =>
  new Worker<T>(
    AI_GENERATE_QUEUE,
    async (job) => processor({ data: job.data, id: job.id }),
    { connection: bullConnection, concurrency }
  );

export const createGithubAnalysisWorker = <T>(
  processor: (job: { data: T; id?: string }) => Promise<void>,
  concurrency: number
) =>
  new Worker<T>(
    GITHUB_ANALYSIS_QUEUE,
    async (job) => processor({ data: job.data, id: job.id }),
    { connection: bullConnection, concurrency }
  );

export const createAiQueueEvents = () =>
  new QueueEvents(AI_GENERATE_QUEUE, { connection: bullConnection });

export const createGithubQueueEvents = () =>
  new QueueEvents(GITHUB_ANALYSIS_QUEUE, { connection: bullConnection });

