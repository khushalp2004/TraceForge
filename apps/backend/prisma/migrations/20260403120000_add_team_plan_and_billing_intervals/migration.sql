-- Add TEAM plan to existing BillingPlan enum.
ALTER TYPE "BillingPlan" ADD VALUE IF NOT EXISTS 'TEAM';

-- Create PlanInterval enum for monthly/yearly subscriptions.
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- Extend User billing state.
ALTER TABLE "User"
ADD COLUMN "planInterval" "PlanInterval";

-- Extend Organization billing state.
ALTER TABLE "Organization"
ADD COLUMN "plan" "BillingPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN "planInterval" "PlanInterval",
ADD COLUMN "subscriptionStatus" TEXT,
ADD COLUMN "planExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentProvider" TEXT,
ADD COLUMN "lastPaymentId" TEXT,
ADD COLUMN "razorpaySubscriptionId" TEXT;

-- Extend Payment to support organization/team billing and intervals.
ALTER TABLE "Payment"
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "interval" "PlanInterval";

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- Track which user requested AI for per-user quota fallback accounting.
ALTER TABLE "Error"
ADD COLUMN "aiRequestedByUserId" TEXT;
