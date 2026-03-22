-- Prevent duplicate notifications for the same join action.
CREATE UNIQUE INDEX "OrgJoinRequest_organizationId_requesterId_inviteToken_status_key"
ON "OrgJoinRequest"("organizationId", "requesterId", "inviteToken", "status");
