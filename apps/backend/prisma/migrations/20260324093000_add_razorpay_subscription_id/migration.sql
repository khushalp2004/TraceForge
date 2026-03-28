-- AlterTable
ALTER TABLE "User" ADD COLUMN "razorpaySubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "razorpaySubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_razorpaySubscriptionId_idx" ON "Payment"("razorpaySubscriptionId");

