-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "environment" TEXT,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'CRITICAL',
    "minOccurrences" INTEGER NOT NULL DEFAULT 1,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "channel" "AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "errorId" TEXT NOT NULL,
    "environment" TEXT,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE INDEX "AlertRule_projectId_idx" ON "AlertRule"("projectId");

-- CreateIndex
CREATE INDEX "AlertRule_isActive_idx" ON "AlertRule"("isActive");

-- CreateIndex
CREATE INDEX "AlertDelivery_alertRuleId_idx" ON "AlertDelivery"("alertRuleId");

-- CreateIndex
CREATE INDEX "AlertDelivery_projectId_idx" ON "AlertDelivery"("projectId");

-- CreateIndex
CREATE INDEX "AlertDelivery_errorId_idx" ON "AlertDelivery"("errorId");

-- CreateIndex
CREATE INDEX "AlertDelivery_triggeredAt_idx" ON "AlertDelivery"("triggeredAt");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_errorId_fkey" FOREIGN KEY ("errorId") REFERENCES "Error"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
