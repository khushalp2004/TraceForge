-- Keep full join-request history while allowing only one active pending request
-- per org/user/invite link at a time.
DROP INDEX IF EXISTS "OrgJoinRequest_organizationId_requesterId_inviteToken_status_key";

CREATE UNIQUE INDEX "OrgJoinRequest_pending_unique"
ON "OrgJoinRequest"("organizationId", "requesterId", "inviteToken")
WHERE "status" = 'PENDING';
