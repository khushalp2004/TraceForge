ALTER TABLE "Project"
ADD COLUMN "apiKeyHash" TEXT;

CREATE UNIQUE INDEX "Project_apiKeyHash_key" ON "Project"("apiKeyHash");
