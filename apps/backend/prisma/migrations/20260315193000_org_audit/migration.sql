-- CreateTable
CREATE TABLE "OrgAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgAuditLog_organizationId_idx" ON "OrgAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "OrgAuditLog_createdAt_idx" ON "OrgAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OrgAuditLog" ADD CONSTRAINT "OrgAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAuditLog" ADD CONSTRAINT "OrgAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
