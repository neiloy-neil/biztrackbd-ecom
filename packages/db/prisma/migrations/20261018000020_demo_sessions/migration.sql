-- Demo admin (docs/41): a visitor gets a private, temporary copy of a demo store. These columns say what kind of demo a tenant is,
-- which template it was copied from, when it is deleted, and (as a hash, never an address) who started it.
ALTER TABLE "Tenant" ADD COLUMN "demoKind" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "demoTemplate" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "demoExpiresAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "demoLastOrderAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "demoCreator" TEXT;
UPDATE "Tenant" SET "demoKind" = 'TEMPLATE' WHERE "isDemo";
CREATE INDEX "Tenant_demoKind_demoExpiresAt_idx" ON "Tenant"("demoKind", "demoExpiresAt");

-- How many visitor demos exist right now, and how many this visitor started in the last hour. Counts only, for the entry gate.
CREATE OR REPLACE FUNCTION demo_session_counts(creator text)
RETURNS TABLE (active integer, recent integer) AS $$
  SELECT
    (SELECT count(*)::int FROM "Tenant" WHERE "demoKind" = 'SESSION' AND "demoExpiresAt" > timezone('utc', now())),
    (SELECT count(*)::int FROM "Tenant" WHERE "demoKind" = 'SESSION' AND "demoCreator" = creator AND "createdAt" > timezone('utc', now()) - interval '1 hour');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Visitor demos past their time, for the cleanup job. Store ids only.
CREATE OR REPLACE FUNCTION demo_expired_sessions()
RETURNS TABLE ("tenantId" text) AS $$
  SELECT id FROM "Tenant" WHERE "demoKind" = 'SESSION' AND "demoExpiresAt" <= timezone('utc', now()) LIMIT 200;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION demo_session_counts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION demo_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demo_session_counts(text) TO biztrack_app, biztrack_platform;
GRANT EXECUTE ON FUNCTION demo_expired_sessions() TO biztrack_app, biztrack_platform;
