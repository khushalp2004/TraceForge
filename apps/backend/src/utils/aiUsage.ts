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

export const getFreeEmailUsageRedisKey = ({
  email,
  monthKey
}: {
  email: string;
  monthKey: string;
}) => `usage:ai:email:${email.trim().toLowerCase()}:${monthKey}`;

export const getFreeEmailUsage = async ({
  email,
  now
}: {
  email: string;
  now: Date;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const usage = await prisma.freeAiEmailUsage.findUnique({
    where: {
      email_monthKey: {
        email: normalizedEmail,
        monthKey: currentMonthKey(now)
      }
    },
    select: {
      amount: true
    }
  });

  return usage?.amount || 0;
};

export const incrementFreeEmailUsage = async ({
  email,
  amount,
  now
}: {
  email: string;
  amount: number;
  now: Date;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || amount <= 0) {
    return;
  }

  await prisma.freeAiEmailUsage.upsert({
    where: {
      email_monthKey: {
        email: normalizedEmail,
        monthKey: currentMonthKey(now)
      }
    },
    update: {
      amount: {
        increment: amount
      }
    },
    create: {
      email: normalizedEmail,
      monthKey: currentMonthKey(now),
      amount
    }
  });
};

export const ensureFreeEmailUsageFloor = async ({
  email,
  amount,
  now
}: {
  email: string;
  amount: number;
  now: Date;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || amount <= 0) {
    return;
  }

  const monthKey = currentMonthKey(now);
  const existing = await prisma.freeAiEmailUsage.findUnique({
    where: {
      email_monthKey: {
        email: normalizedEmail,
        monthKey
      }
    },
    select: {
      id: true,
      amount: true
    }
  });

  if (existing) {
    if (existing.amount >= amount) {
      return;
    }

    await prisma.freeAiEmailUsage.update({
      where: { id: existing.id },
      data: { amount }
    });
    return;
  }

  await prisma.freeAiEmailUsage.create({
    data: {
      email: normalizedEmail,
      monthKey,
      amount
    }
  });
};

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
  email,
  now
}: {
  userId: string;
  organizationId?: string | null;
  email?: string | null;
  now: Date;
}) => {
  const monthKey = currentMonthKey(now);
  const [persistedUsage, freeEmailUsage] = await Promise.all([
    getPersistedAiUsage({
      userId,
      organizationId,
      now
    }),
    !organizationId && email ? getFreeEmailUsage({ email, now }) : Promise.resolve(0)
  ]);
  const persistedFloor = Math.max(persistedUsage, freeEmailUsage);

  if (!redis.isOpen) {
    return persistedFloor;
  }

  const redisUsage = Number(
    (await redis.get(
      organizationId
        ? getRedisUsageKey({
            userId,
            organizationId,
            monthKey
          })
        : email
          ? getFreeEmailUsageRedisKey({
              email,
              monthKey
            })
          : getRedisUsageKey({
              userId,
              organizationId,
              monthKey
            })
    )) || "0"
  );

  return Math.max(redisUsage, persistedFloor);
};

export const reserveAiUsage = async ({
  userId,
  organizationId,
  email,
  amount,
  now
}: {
  userId: string;
  organizationId?: string | null;
  email?: string | null;
  amount: number;
  now: Date;
}) => {
  if (!redis.isOpen || amount <= 0) return;

  const monthKey = currentMonthKey(now);
  const key = organizationId
    ? getRedisUsageKey({ userId, organizationId, monthKey })
    : email
      ? getFreeEmailUsageRedisKey({ email, monthKey })
      : getRedisUsageKey({ userId, organizationId, monthKey });

  // Get current effective usage to ensure we increment from the persisted floor if Redis is empty or lower
  const effectiveUsage = await getEffectiveAiUsage({ userId, organizationId, email, now });
  
  // Set the redis key to the max of current redis or persisted floor + the new amount
  await redis.set(key, (effectiveUsage + amount).toString(), {
    EX: 30 * 24 * 60 * 60 // Expire in 30 days
  });
};

export const refundAiUsage = async ({
  userId,
  organizationId,
  email,
  amount,
  now
}: {
  userId: string;
  organizationId?: string | null;
  email?: string | null;
  amount: number;
  now: Date;
}) => {
  if (!redis.isOpen || amount <= 0) return;

  const monthKey = currentMonthKey(now);
  const key = organizationId
    ? getRedisUsageKey({ userId, organizationId, monthKey })
    : email
      ? getFreeEmailUsageRedisKey({ email, monthKey })
      : getRedisUsageKey({ userId, organizationId, monthKey });

  const currentRedisUsage = Number((await redis.get(key)) || "0");
  if (currentRedisUsage > 0) {
    const newUsage = Math.max(0, currentRedisUsage - amount);
    await redis.set(key, newUsage.toString(), {
      EX: 30 * 24 * 60 * 60
    });
  }
};
