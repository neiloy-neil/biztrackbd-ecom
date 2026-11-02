-- Allow biztrack_app (used by marketing signup and admin actions) to SELECT PLATFORM_ADMIN tokens for push notifications
-- while strictly preserving tenant isolation for modifications and merchant tokens.
DROP POLICY IF EXISTS mobile_device_token_tenant_isolation ON "public"."MobileDeviceToken";
DROP POLICY IF EXISTS mobile_device_token_tenant_select ON "public"."MobileDeviceToken";
DROP POLICY IF EXISTS mobile_device_token_tenant_modify ON "public"."MobileDeviceToken";

CREATE POLICY mobile_device_token_tenant_select ON "public"."MobileDeviceToken"
  FOR SELECT
  TO biztrack_app
  USING (
    ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.current_tenant_id', true))
    OR ("appType" = 'PLATFORM_ADMIN')
  );

CREATE POLICY mobile_device_token_tenant_modify ON "public"."MobileDeviceToken"
  FOR ALL
  TO biztrack_app
  USING ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.current_tenant_id', true));
