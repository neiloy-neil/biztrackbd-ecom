-- The lead activity timeline (docs/54): the model and the admin leads page existed without a migration, so /leads and the dashboard of a
-- business site returned 500 on any database built from migrations. Additive and safe to run again.

-- The lead's owner column was also in the model without a migration.
ALTER TABLE "SiteLead" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;
CREATE INDEX IF NOT EXISTS "SiteLead_tenantId_assignedToUserId_idx" ON "SiteLead"("tenantId", "assignedToUserId");

DO $$ BEGIN
  CREATE TYPE "LeadActivityType" AS ENUM ('STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'WHATSAPP_CLICKED', 'CALL_LOGGED', 'EMAIL_DISPATCHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SiteLeadActivity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "activityType" "LeadActivityType" NOT NULL,
  "note" TEXT,
  "beforeStatus" "SiteLeadStatus",
  "afterStatus" "SiteLeadStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteLeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteLeadActivity_tenantId_leadId_createdAt_idx" ON "SiteLeadActivity"("tenantId", "leadId", "createdAt");

ALTER TABLE "SiteLeadActivity" DROP CONSTRAINT IF EXISTS "SiteLeadActivity_leadId_fkey";
ALTER TABLE "SiteLeadActivity" ADD CONSTRAINT "SiteLeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SiteLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteLeadActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteLeadActivity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "SiteLeadActivity";
CREATE POLICY tenant_isolation_policy ON "SiteLeadActivity" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "SiteLeadActivity" TO biztrack_app;
