-- CreateTable
CREATE TABLE "MarketingSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sourcePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBSCRIBED',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscriber_email_key" ON "MarketingSubscriber"("email");

-- CreateIndex
CREATE INDEX "MarketingSubscriber_status_idx" ON "MarketingSubscriber"("status");

-- CreateIndex
CREATE INDEX "MarketingSubscriber_subscribedAt_idx" ON "MarketingSubscriber"("subscribedAt");
