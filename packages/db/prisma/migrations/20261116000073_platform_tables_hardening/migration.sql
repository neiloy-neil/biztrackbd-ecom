-- Migration 063 says the notification feed and its recipient list have "no policy and no grant for the store-app role" and are reached only
-- through two SECURITY DEFINER functions. The default privileges set in migration 002 granted the app role full access anyway. Row-level
-- security with no policy hides every row, so nothing leaked, but the grant should not exist. Nothing in the code reads these tables as the app role.
REVOKE ALL ON "PlatformNotification" FROM biztrack_app;
REVOKE ALL ON "PlatformNotifyRecipient" FROM biztrack_app;

-- MobileDeviceToken (migrations 067 and 071): the same rules, written the way every other tenant table writes them, so the row-level security
-- sweep (packages/db tests) can check them. `current_tenant()` is NULLIF(current_setting('app.current_tenant_id', true), ''), which is what
-- the inline text did, so behaviour is unchanged: a store sees and changes only its own tokens, and may also READ platform-admin tokens
-- (the marketing signup and admin actions push to them). FORCE makes the rule bind the table owner too.
ALTER TABLE "MobileDeviceToken" FORCE ROW LEVEL SECURITY;

-- 067 created the first policy and 071 replaced it; drop all three names so the result is the same whichever of them ran.
DROP POLICY IF EXISTS mobile_device_token_tenant_isolation ON "MobileDeviceToken";
DROP POLICY IF EXISTS mobile_device_token_tenant_select ON "MobileDeviceToken";
DROP POLICY IF EXISTS mobile_device_token_tenant_modify ON "MobileDeviceToken";

CREATE POLICY mobile_device_token_tenant_select ON "MobileDeviceToken"
  FOR SELECT TO biztrack_app
  USING ("tenantId" = current_tenant() OR "appType" = 'PLATFORM_ADMIN');

CREATE POLICY mobile_device_token_tenant_modify ON "MobileDeviceToken"
  FOR ALL TO biztrack_app
  USING ("tenantId" = current_tenant())
  WITH CHECK ("tenantId" = current_tenant());
