-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subdomainChangedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "previousSubdomain" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "previousSubdomainExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_previousSubdomain_key" ON "Tenant"("previousSubdomain");

-- Update signup_subdomain_taken to also reserve unexpired previousSubdomain
CREATE OR REPLACE FUNCTION signup_subdomain_taken(p_subdomain text) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "Tenant" WHERE subdomain = lower(p_subdomain))
      OR EXISTS (SELECT 1 FROM "Tenant" WHERE "previousSubdomain" = lower(p_subdomain) AND ("previousSubdomainExpiresAt" IS NULL OR "previousSubdomainExpiresAt" > timezone('utc', now())))
      OR EXISTS (SELECT 1 FROM "Domain" WHERE domain = lower(p_subdomain));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION signup_subdomain_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION signup_subdomain_taken(text) TO biztrack_app, biztrack_platform;

-- Update resolve_tenant_by_host to also resolve unexpired previousSubdomain
CREATE OR REPLACE FUNCTION resolve_tenant_by_host(p_host text, p_root_domain text)
RETURNS TABLE (id text, status "TenantStatus", "themeId" text, subdomain text, locale text) AS $$
  SELECT t.id, t.status, t."themeId", t.subdomain, t.locale
  FROM "Tenant" t
  WHERE p_host = t.subdomain || '.' || p_root_domain
     OR (t."previousSubdomain" IS NOT NULL AND p_host = t."previousSubdomain" || '.' || p_root_domain AND (t."previousSubdomainExpiresAt" IS NULL OR t."previousSubdomainExpiresAt" > timezone('utc', now())))
     OR EXISTS (SELECT 1 FROM "Domain" d WHERE d."tenantId" = t.id AND d.verified AND d.domain = p_host)
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION resolve_tenant_by_host(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant_by_host(text, text) TO biztrack_app, biztrack_platform;

-- Update resolve_host_entry to also flag matched as 'previous_subdomain'
CREATE OR REPLACE FUNCTION resolve_host_entry(p_host text, p_root_domain text)
RETURNS TABLE (
  "tenantId" text, status "TenantStatus", "themeId" text, subdomain text, locale text,
  matched text, "primaryDomain" text, "redirectWww" boolean
) AS $$
  SELECT t.id, t.status, t."themeId", t.subdomain, t.locale,
    CASE WHEN p_host = t.subdomain || '.' || p_root_domain THEN 'subdomain'
         WHEN t."previousSubdomain" IS NOT NULL AND p_host = t."previousSubdomain" || '.' || p_root_domain THEN 'previous_subdomain'
         WHEN d.domain = p_host THEN 'custom'
         ELSE 'custom_www' END,
    (SELECT p.domain FROM "Domain" p WHERE p."tenantId" = t.id AND p.verified AND p."isPrimary" LIMIT 1),
    COALESCE(d."redirectWww", true)
  FROM "Tenant" t
  LEFT JOIN "Domain" d ON d."tenantId" = t.id AND d.verified
    AND (d.domain = p_host OR (d."redirectWww" AND 'www.' || d.domain = p_host))
  WHERE p_host = t.subdomain || '.' || p_root_domain
     OR (t."previousSubdomain" IS NOT NULL AND p_host = t."previousSubdomain" || '.' || p_root_domain AND (t."previousSubdomainExpiresAt" IS NULL OR t."previousSubdomainExpiresAt" > timezone('utc', now())))
     OR d.id IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION resolve_host_entry(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_host_entry(text, text) TO biztrack_app, biztrack_platform;
