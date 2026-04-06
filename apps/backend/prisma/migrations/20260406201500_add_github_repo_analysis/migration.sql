-- CreateEnum
CREATE TYPE "GithubRepoAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('GITHUB_REPO_ANALYSIS');

-- CreateTable
CREATE TABLE "GithubRepoAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoUrl" TEXT,
    "status" "GithubRepoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "summary" TEXT,
    "architecture" TEXT,
    "runtimeFlow" TEXT,
    "developmentFlow" TEXT,
    "techStack" JSONB,
    "keyModules" JSONB,
    "entryPoints" JSONB,
    "risks" JSONB,
    "onboardingTips" JSONB,
    "lastError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "kind" "AiUsageKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepoAnalysis_projectId_key" ON "GithubRepoAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "GithubRepoAnalysis_status_idx" ON "GithubRepoAnalysis"("status");

-- CreateIndex
CREATE INDEX "GithubRepoAnalysis_generatedAt_idx" ON "GithubRepoAnalysis"("generatedAt");

-- CreateIndex
CREATE INDEX "AiUsageEntry_userId_createdAt_idx" ON "AiUsageEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEntry_organizationId_createdAt_idx" ON "AiUsageEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEntry_projectId_createdAt_idx" ON "AiUsageEntry"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEntry_kind_createdAt_idx" ON "AiUsageEntry"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "GithubRepoAnalysis" ADD CONSTRAINT "GithubRepoAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEntry" ADD CONSTRAINT "AiUsageEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEntry" ADD CONSTRAINT "AiUsageEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEntry" ADD CONSTRAINT "AiUsageEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
