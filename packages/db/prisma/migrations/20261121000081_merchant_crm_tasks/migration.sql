-- Merchant CRM, phase 3: follow-up tasks with an owner and a due date, and saved segments. Both are platform-only: the store's role has no access.
CREATE TABLE "TenantFollowUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TenantFollowUp_status_dueAt_idx" ON "TenantFollowUp"("status", "dueAt");
CREATE INDEX "TenantFollowUp_tenantId_status_idx" ON "TenantFollowUp"("tenantId", "status");
CREATE INDEX "TenantFollowUp_assigneeId_status_dueAt_idx" ON "TenantFollowUp"("assigneeId", "status", "dueAt");
ALTER TABLE "TenantFollowUp" ADD CONSTRAINT "TenantFollowUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

REVOKE ALL ON "TenantFollowUp" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantFollowUp" TO biztrack_platform;
ALTER TABLE "TenantFollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantFollowUp" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "TenantFollowUp";
CREATE POLICY tenant_isolation_policy ON "TenantFollowUp" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

CREATE TABLE "CrmSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmSegment_pkey" PRIMARY KEY ("id")
);
REVOKE ALL ON "CrmSegment" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CrmSegment" TO biztrack_platform;
