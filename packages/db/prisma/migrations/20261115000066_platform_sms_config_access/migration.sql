-- Allow store-side application connections (biztrack_app) to read SMS gateway settings
-- from PlatformConfig so that customer OTP login and notifications can dispatch
-- via the platform-configured SMS provider (BulkSMSBD) without falling back to stale environment variables.

DROP POLICY IF EXISTS platform_config_public_read ON "PlatformConfig";
CREATE POLICY platform_config_public_read ON "PlatformConfig" FOR SELECT TO biztrack_app
  USING (
    key LIKE 'contact\_%' 
    OR key LIKE 'platform\_seo\_%' 
    OR key = 'google_site_verification'
    OR key LIKE 'sms\_%'
  );

-- Update platform_config_value to allow reading SMS settings through security definer RPC
CREATE OR REPLACE FUNCTION platform_config_value(p_key text)
RETURNS text AS $$
  SELECT c."value" FROM "PlatformConfig" c
  WHERE c."key" = p_key AND (
    p_key IN (
      'fraud_checker_api_key', 'fraud_checker_api_url', 'gemini_api_key', 'gemini_default_model',
      'sms_provider', 'sms_api_key', 'sms_sender_id',
      'sms_bulksmsbd_api_key', 'sms_bulksmsbd_sender_id',
      'sms_smsnetbd_api_key', 'sms_smsnetbd_sender_id',
      'sms_greenweb_token', 'sms_greenweb_api_key',
      'sms_custom_endpoint', 'sms_custom_api_key', 'sms_custom_sender_id', 'sms_custom_method'
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION platform_config_value(text) TO biztrack_app, biztrack_platform;
