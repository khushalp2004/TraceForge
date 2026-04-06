import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";

export const currentMonthKey = (now: Date) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

export const currentMonthStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

export const getRedisUsageKey = ({
  userId,
  organizationId,
  monthKey
}: {
  userId: string;
  organizationId?: string | null;
  monthKey: string;
}) =>
  organizationId
    ? `usage:ai:org:${organizationId}:${monthKey}`
    : `usage:ai:user:${userId}:${monthKey}`;

export const getPersistedAiUsage = async ({
  userId,
  organizationId,
  now
}: {
  userId: string;
  organizationId?: string | null;
  now: Date;
}) => {
  const monthStart = currentMonthStart(now);

  const [errorAnalysisCount, usageEntriesAggregate] = await Promise.all([
    prisma.errorAnalysis.count({
      where: {
        createdAt: { gte: monthStart },
        error: organizationId
          ? {
              project: {
                orgId: organizationId
              }
            }
          : {
              aiRequestedByUserId: userId
            }
      }
    }),
    prisma.aiUsageEntry.aggregate({
      _sum: {
        amount: true
      },
      where: {
        createdAt: { gte: monthStart },
        ...(organizationId ? { organizationId } : { userId, organizationId: null })
      }
    })
  ]);

  return errorAnalysisCount + (usageEntriesAggregate._sum.amount || 0);
};

export const getEffectiveAiUsage = async ({
  userId,
  organizationId,
  now
}: {
  userId: string;
  organizationId?: string | null;
  now: Date;
}) => {
  const monthKey = currentMonthKey(now);
  const persistedUsage = await getPersistedAiUsage({
    userId,
    organizationId,
    now
  });

  if (!redis.isOpen) {
    return persistedUsage;
  }

  const redisUsage = Number(
    (await redis.get(
      getRedisUsageKey({
        userId,
        organizationId,
        monthKey
      })
    )) || "0"
  );

  return Math.max(redisUsage, persistedUsage);
};
