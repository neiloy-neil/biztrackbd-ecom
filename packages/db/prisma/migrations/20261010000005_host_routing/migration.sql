-- Hostname routing (docs/13).

-- 1. Exact subdomain matching. The first version compared only the first label and a LIKE suffix, so
--    "rongdhonu.anything.example.com" resolved to the rongdhonu store. A store is reached at <subdomain>.<root> and nothing else.
CREATE OR REPLACE FUNCTION resolve_tenant_by_host(p_host text, p_root_domain text)
RETURNS TABLE (id text, status "TenantStatus", "themeId" text, subdomain text, locale text) AS $$
  SELECT t.id, t.status, t."themeId", t.subdomain, t.locale
  FROM "Tenant" t
  WHERE p_host = t.subdomain || '.' || p_root_domain
     OR EXISTS (SELECT 1 FROM "Domain" d WHERE d."tenantId" = t.id AND d.verified AND d.domain = p_host)
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Everything the router needs in one lookup: which store, how the host matched, and the store's canonical (primary,
--    verified) custom domain. Only verified domains route, so claiming a domain you do not control sends no traffic anywhere.
--    matched = 'subdomain' | 'custom' | 'custom_www' (the www. twin of a verified domain, which redirects to the apex).
CREATE OR REPLACE FUNCTION resolve_host_entry(p_host text, p_root_domain text)
RETURNS TABLE (
  "tenantId" text, status "TenantStatus", "themeId" text, subdomain text, locale text,
  matched text, "primaryDomain" text, "redirectWww" boolean
) AS $$
  SELECT t.id, t.status, t."themeId", t.subdomain, t.locale,
    CASE WHEN p_host = t.subdomain || '.' || p_root_domain THEN 'subdomain'
         WHEN d.domain = p_host THEN 'custom'
         ELSE 'custom_www' END,
    (SELECT p.domain FROM "Domain" p WHERE p."tenantId" = t.id AND p.verified AND p."isPrimary" LIMIT 1),
    COALESCE(d."redirectWww", true)
  FROM "Tenant" t
  LEFT JOIN "Domain" d ON d."tenantId" = t.id AND d.verified
    AND (d.domain = p_host OR (d."redirectWww" AND 'www.' || d.domain = p_host))
  WHERE p_host = t.subdomain || '.' || p_root_domain OR d.id IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION resolve_host_entry(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_host_entry(text, text) TO biztrack_app, biztrack_platform;

-- 3. At most one primary domain per store, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "Domain_one_primary_per_tenant" ON "Domain" ("tenantId") WHERE "isPrimary";

-- 4. Domain names are globally unique, but a claim nobody verified must not lock the real owner out forever. An
--    unverified claim older than 24 hours can be released by a new claimant. Runs as definer because the old claim belongs
--    to another store and row-level security hides it. Returns how many claims it released; reveals nothing else.
CREATE OR REPLACE FUNCTION release_stale_domain_claim(p_domain text) RETURNS integer AS $$
  WITH gone AS (
    DELETE FROM "Domain" WHERE domain = p_domain AND NOT verified AND "createdAt" < now() - interval '24 hours' RETURNING 1
  ) SELECT count(*)::int FROM gone;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION release_stale_domain_claim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_stale_domain_claim(text) TO biztrack_app, biztrack_platform;
