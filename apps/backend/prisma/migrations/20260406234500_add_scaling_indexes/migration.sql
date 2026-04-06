-- Payment
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");
CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");

-- OrganizationInvite / OrgJoinRequest
CREATE INDEX "OrganizationInvite_organizationId_expiresAt_idx" ON "OrganizationInvite"("organizationId", "expiresAt");
CREATE INDEX "OrgJoinRequest_organizationId_status_createdAt_idx" ON "OrgJoinRequest"("organizationId", "status", "createdAt");

-- Project / Error / ErrorEvent / Release
CREATE INDEX "Project_userId_archivedAt_createdAt_idx" ON "Project"("userId", "archivedAt", "createdAt");
CREATE INDEX "Project_orgId_archivedAt_createdAt_idx" ON "Project"("orgId", "archivedAt", "createdAt");
CREATE INDEX "Error_projectId_archivedAt_lastSeen_idx" ON "Error"("projectId", "archivedAt", "lastSeen");
CREATE INDEX "Error_projectId_archivedAt_count_idx" ON "Error"("projectId", "archivedAt", "count");
CREATE INDEX "ErrorEvent_errorId_timestamp_idx" ON "ErrorEvent"("errorId", "timestamp");
CREATE INDEX "ErrorEvent_timestamp_environment_idx" ON "ErrorEvent"("timestamp", "environment");
CREATE INDEX "Release_projectId_releasedAt_idx" ON "Release"("projectId", "releasedAt");

-- Alerts
CREATE INDEX "AlertRule_userId_archivedAt_isActive_idx" ON "AlertRule"("userId", "archivedAt", "isActive");
CREATE INDEX "AlertRule_projectId_archivedAt_isActive_idx" ON "AlertRule"("projectId", "archivedAt", "isActive");
CREATE INDEX "AlertDelivery_projectId_triggeredAt_idx" ON "AlertDelivery"("projectId", "triggeredAt");
CREATE INDEX "AlertDelivery_errorId_triggeredAt_idx" ON "AlertDelivery"("errorId", "triggeredAt");
CREATE INDEX "AlertDelivery_alertRuleId_triggeredAt_idx" ON "AlertDelivery"("alertRuleId", "triggeredAt");

-- Integrations / AI usage
CREATE INDEX "IntegrationConnection_provider_organizationId_status_idx" ON "IntegrationConnection"("provider", "organizationId", "status");
CREATE INDEX "IntegrationConnection_provider_userId_status_idx" ON "IntegrationConnection"("provider", "userId", "status");
CREATE INDEX "AiUsageEntry_userId_kind_createdAt_idx" ON "AiUsageEntry"("userId", "kind", "createdAt");
CREATE INDEX "AiUsageEntry_organizationId_kind_createdAt_idx" ON "AiUsageEntry"("organizationId", "kind", "createdAt");
