CREATE TYPE "ErrorAiStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "Error"
ADD COLUMN "aiStatus" "ErrorAiStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "aiLastError" TEXT,
ADD COLUMN "aiRequestedAt" TIMESTAMP(3),
ADD COLUMN "aiCompletedAt" TIMESTAMP(3);

UPDATE "Error"
SET
  "aiStatus" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ErrorAnalysis"
      WHERE "ErrorAnalysis"."errorId" = "Error"."id"
    ) THEN 'READY'::"ErrorAiStatus"
    ELSE 'PENDING'::"ErrorAiStatus"
  END,
  "aiRequestedAt" = COALESCE("firstSeen", NOW()),
  "aiCompletedAt" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ErrorAnalysis"
      WHERE "ErrorAnalysis"."errorId" = "Error"."id"
    ) THEN COALESCE(
      (
        SELECT "createdAt"
        FROM "ErrorAnalysis"
        WHERE "ErrorAnalysis"."errorId" = "Error"."id"
        LIMIT 1
      ),
      NOW()
    )
    ELSE NULL
  END;
