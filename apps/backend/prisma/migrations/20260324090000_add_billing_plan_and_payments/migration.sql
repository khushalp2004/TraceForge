-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "plan" "BillingPlan" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "planExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastPaymentProvider" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastPaymentId" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "plan" "BillingPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

