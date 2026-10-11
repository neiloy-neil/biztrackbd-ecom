-- TenantNote is platform-only (the store's role has no grant on it), but every table with a tenantId carries row-level security, forced,
-- so a later grant by mistake still cannot show one store another store's notes. The platform role bypasses RLS like it does elsewhere.
ALTER TABLE "TenantNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantNote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "TenantNote";
CREATE POLICY tenant_isolation_policy ON "TenantNote" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
