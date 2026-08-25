-- AlterTable
ALTER TABLE "GithubRepoAnalysis" ADD COLUMN "graphStatus" "GithubRepoAnalysisStatus" NOT NULL DEFAULT 'UNINITIALIZED',
ADD COLUMN "systemDesignStatus" "GithubRepoAnalysisStatus" NOT NULL DEFAULT 'UNINITIALIZED';
