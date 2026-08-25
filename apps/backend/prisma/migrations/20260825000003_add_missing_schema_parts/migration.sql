-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- DropForeignKey
ALTER TABLE "OrgAuditLog" DROP CONSTRAINT "OrgAuditLog_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrgJoinRequest" DROP CONSTRAINT "OrgJoinRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrgJoinRequest" DROP CONSTRAINT "OrgJoinRequest_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationInvite" DROP CONSTRAINT "OrganizationInvite_createdById_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationInvite" DROP CONSTRAINT "OrganizationInvite_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationMember" DROP CONSTRAINT "OrganizationMember_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationMember" DROP CONSTRAINT "OrganizationMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropIndex
DROP INDEX "Payment_razorpaySubscriptionId_idx";

-- AlterTable
ALTER TABLE "FreeAiEmailUsage" ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GithubRepoAnalysis" ADD COLUMN     "systemDesign" JSONB;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RepoFileChunk" (
    "id" TEXT NOT NULL,
    "githubAnalysisId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "vector" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoFileChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepoFileChunk_githubAnalysisId_idx" ON "RepoFileChunk"("githubAnalysisId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAuditLog" ADD CONSTRAINT "OrgAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoFileChunk" ADD CONSTRAINT "RepoFileChunk_githubAnalysisId_fkey" FOREIGN KEY ("githubAnalysisId") REFERENCES "GithubRepoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

