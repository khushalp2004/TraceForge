-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GITHUB', 'SLACK', 'JIRA', 'PAGERDUTY');

-- CreateEnum
CREATE TYPE "IntegrationScope" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "scope" "IntegrationScope" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "userId" TEXT,
    "organizationId" TEXT,
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_provider_userId_key" ON "IntegrationConnection"("provider", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_provider_organizationId_key" ON "IntegrationConnection"("provider", "organizationId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_userId_idx" ON "IntegrationConnection"("userId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_organizationId_idx" ON "IntegrationConnection"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_provider_scope_idx" ON "IntegrationConnection"("provider", "scope");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
