-- CreateEnum
CREATE TYPE "ReleaseSource" AS ENUM ('MANUAL', 'INGEST');

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "environment" TEXT,
    "notes" TEXT,
    "source" "ReleaseSource" NOT NULL DEFAULT 'MANUAL',
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ErrorEvent" ADD COLUMN "releaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Release_projectId_version_key" ON "Release"("projectId", "version");

-- CreateIndex
CREATE INDEX "Release_projectId_idx" ON "Release"("projectId");

-- CreateIndex
CREATE INDEX "Release_releasedAt_idx" ON "Release"("releasedAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_releaseId_idx" ON "ErrorEvent"("releaseId");

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorEvent" ADD CONSTRAINT "ErrorEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;
