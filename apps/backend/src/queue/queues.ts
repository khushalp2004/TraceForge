import { Queue } from "bullmq";
import { URL } from "node:url";

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

const connection = toBullConnection();

export const AI_GENERATE_QUEUE = "ai-generate";
export const GITHUB_ANALYSIS_QUEUE = "github-repo-analysis";
export const BILLING_RECONCILIATION_QUEUE = "billing-reconciliation";

export const aiGenerateQueue = new Queue(AI_GENERATE_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});
export const githubAnalysisQueue = new Queue(GITHUB_ANALYSIS_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

export const billingReconciliationQueue = new Queue(BILLING_RECONCILIATION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 10,
    removeOnFail: 50
  }
});

export const closeQueues = async () => {
  await Promise.all([
    aiGenerateQueue.close(),
    githubAnalysisQueue.close(),
    billingReconciliationQueue.close()
  ]);
};

export { toBullConnection };

