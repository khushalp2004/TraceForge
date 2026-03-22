-- AlterTable
ALTER TABLE "Error" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Error_archivedAt_idx" ON "Error"("archivedAt");

-- CreateIndex
CREATE INDEX "AlertRule_archivedAt_idx" ON "AlertRule"("archivedAt");
