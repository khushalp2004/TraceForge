-- CreateEnum
CREATE TYPE "ProPricingTier" AS ENUM ('LAUNCH', 'STANDARD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "proPricingTier" "ProPricingTier";

