-- Tables added in migrations 31 to 35 did not follow the isolation rules every other tenant table follows (docs/08, section 3):
--   MarketingCampaign   had no row-level security at all, so any store connection could read every store's campaigns;
--   PosRegister, PosSession, PosCashMovement   had only a RESTRICTIVE policy and no policy that grants access, so the app role could
--                                               read nothing and every insert (the /pos page opens a register) failed with "violates row-level security";
--   TenantQuotaAdjustment   had row-level security on but not forced.
-- This gives all of them the standard pair: security enabled and forced, and one policy that names the tenant for every command and checks
-- written rows.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['MarketingCampaign', 'PosRegister', 'PosSession', 'PosCashMovement', 'TenantQuotaAdjustment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
  END LOOP;
END $$;

-- Platform tables are for the platform role only. The one thing a store connection needs from PlatformConfig goes through platform_config_value()
-- (migration 36), which returns a named, allow-listed key; nothing else in it, and none of SubscriptionPromo, should be selectable from a store.
REVOKE ALL ON "PlatformConfig", "SubscriptionPromo" FROM biztrack_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON "MarketingCampaign", "PosRegister", "PosSession", "PosCashMovement" TO biztrack_app;
