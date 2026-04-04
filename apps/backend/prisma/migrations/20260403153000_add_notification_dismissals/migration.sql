CREATE TYPE "NotificationDismissalKind" AS ENUM ('ALERT', 'INVITE', 'JOIN_REQUEST');

CREATE TABLE "NotificationDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationDismissalKind" NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDismissal_userId_kind_notificationKey_key"
ON "NotificationDismissal"("userId", "kind", "notificationKey");

CREATE INDEX "NotificationDismissal_userId_kind_idx"
ON "NotificationDismissal"("userId", "kind");

ALTER TABLE "NotificationDismissal"
ADD CONSTRAINT "NotificationDismissal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
