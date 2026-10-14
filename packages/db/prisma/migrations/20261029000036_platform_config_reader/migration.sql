-- Store-side code needs a few platform settings (the fraud checker key, the platform AI key). PlatformConfig has row-level security on and no
-- policy for the app role, so a direct read returns nothing. This function is the one way in: it returns the value of ONE named key,
-- and only for keys on the list below. Everything else in the table stays unreachable from a store connection.
CREATE OR REPLACE FUNCTION platform_config_value(p_key text)
RETURNS text AS $$
  SELECT c."value" FROM "PlatformConfig" c
  WHERE c."key" = p_key AND p_key IN ('fraud_checker_api_key', 'fraud_checker_api_url', 'gemini_api_key', 'gemini_default_model');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_config_value(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_config_value(text) TO biztrack_app, biztrack_platform;
