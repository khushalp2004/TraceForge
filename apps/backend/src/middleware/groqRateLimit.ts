import { rateLimitByUser } from "./rateLimit.js";

const parseEnvLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const groqPerMinuteLimit = parseEnvLimit(process.env.GROQ_RATE_LIMIT_PER_MINUTE, 1);
const groqPerHourLimit = parseEnvLimit(process.env.GROQ_RATE_LIMIT_PER_HOUR, 5);

export const groqRequestRateLimits = [
  rateLimitByUser("ai:groq:request:minute", {
    windowSeconds: 60,
    maxRequests: groqPerMinuteLimit,
    message: `AI generation is limited to ${groqPerMinuteLimit} request${groqPerMinuteLimit === 1 ? "" : "s"} per minute for each user.`
  }),
  rateLimitByUser("ai:groq:request:hour", {
    windowSeconds: 60 * 60,
    maxRequests: groqPerHourLimit,
    message: `AI generation is limited to ${groqPerHourLimit} request${groqPerHourLimit === 1 ? "" : "s"} per hour for each user.`
  })
];
