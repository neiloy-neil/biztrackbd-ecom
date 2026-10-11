-- Webhook URLs carry a random integrationToken instead of a tenant id. This resolves it before any tenant is
-- known (SECURITY DEFINER, same pattern as resolve_tenant_by_host). Returns only what a webhook handler needs.
CREATE OR REPLACE FUNCTION resolve_integration_by_token(p_token text)
RETURNS TABLE ("tenantId" text, provider text, mode "IntegrationMode") AS $$
  SELECT i."tenantId", i.provider, i.mode
  FROM "TenantIntegration" i
  WHERE i."integrationToken" = p_token AND i.status <> 'DISABLED'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION resolve_integration_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_integration_by_token(text) TO biztrack_app, biztrack_platform;
