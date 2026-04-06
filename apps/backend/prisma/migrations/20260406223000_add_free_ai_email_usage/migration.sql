CREATE TABLE "FreeAiEmailUsage" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeAiEmailUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreeAiEmailUsage_email_monthKey_key" ON "FreeAiEmailUsage"("email", "monthKey");
CREATE INDEX "FreeAiEmailUsage_monthKey_idx" ON "FreeAiEmailUsage"("monthKey");
