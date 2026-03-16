-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "OrgJoinRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "inviteToken" TEXT,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "OrgJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgJoinRequest_organizationId_idx" ON "OrgJoinRequest"("organizationId");

-- CreateIndex
CREATE INDEX "OrgJoinRequest_requesterId_idx" ON "OrgJoinRequest"("requesterId");

-- CreateIndex
CREATE INDEX "OrgJoinRequest_status_idx" ON "OrgJoinRequest"("status");

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
