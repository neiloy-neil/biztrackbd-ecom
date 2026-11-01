-- Enable Row Level Security on MobileDeviceToken and revoke PostgREST public access
ALTER TABLE "public"."MobileDeviceToken" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "public"."MobileDeviceToken" FROM PUBLIC;
REVOKE ALL ON "public"."MobileDeviceToken" FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."MobileDeviceToken" TO biztrack_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."MobileDeviceToken" TO biztrack_app;

DROP POLICY IF EXISTS mobile_device_token_tenant_isolation ON "public"."MobileDeviceToken";
CREATE POLICY mobile_device_token_tenant_isolation ON "public"."MobileDeviceToken"
  FOR ALL
  TO biztrack_app
  USING ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.current_tenant_id', true));
