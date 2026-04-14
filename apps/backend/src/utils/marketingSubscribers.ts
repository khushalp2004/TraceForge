import { randomUUID } from "crypto";
import prisma from "../db/prisma.js";

type MarketingSubscriberDelegate = {
  upsert: (args: {
    where: { email: string };
    update: { status: string; sourcePath?: string | undefined; subscribedAt: Date };
    create: { email: string; sourcePath?: string | undefined; status: string };
    select: { id: true };
  }) => Promise<{ id: string }>;
};

const getMarketingSubscriberDelegate = () =>
  (
    prisma as typeof prisma & {
      marketingSubscriber?: MarketingSubscriberDelegate;
    }
  ).marketingSubscriber;

export const subscribeMarketingEmail = async ({
  email,
  sourcePath
}: {
  email: string;
  sourcePath?: string;
}) => {
  const subscriberDelegate = getMarketingSubscriberDelegate();

  const subscriber = subscriberDelegate
    ? await subscriberDelegate.upsert({
        where: { email },
        update: {
          status: "SUBSCRIBED",
          sourcePath: sourcePath || undefined,
          subscribedAt: new Date()
        },
        create: {
          email,
          sourcePath: sourcePath || undefined,
          status: "SUBSCRIBED"
        },
        select: {
          id: true
        }
      })
    : (
        await prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO "MarketingSubscriber" ("id", "email", "sourcePath", "status", "subscribedAt", "updatedAt")
          VALUES (${`ms_${randomUUID().replace(/-/g, "")}`}, ${email}, ${sourcePath || null}, 'SUBSCRIBED', NOW(), NOW())
          ON CONFLICT ("email")
          DO UPDATE SET
            "status" = 'SUBSCRIBED',
            "sourcePath" = EXCLUDED."sourcePath",
            "subscribedAt" = NOW(),
            "updatedAt" = NOW()
          RETURNING "id"
        `
      )[0];

  if (!subscriber?.id) {
    throw new Error("Unable to save marketing subscriber");
  }

  return subscriber;
};
