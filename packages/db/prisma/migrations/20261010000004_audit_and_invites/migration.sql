-- 1. The audit log is append-only for the application role: it can write and read entries, never change or remove them.
--    (Tenant deletion cascades as the owner role. If a later migration re-runs GRANT ... ON ALL TABLES, repeat this REVOKE.)
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM biztrack_app;

-- 2. Invite acceptance happens before anyone is signed in, so the tenant is not known yet. This looks an invite up by the
--    SHA-256 of its token (SECURITY DEFINER, same pattern as resolve_tenant_by_host) and returns only what acceptance needs.
CREATE OR REPLACE FUNCTION resolve_invite_by_token_hash(p_hash text)
RETURNS TABLE (id text, "tenantId" text, email text, role "StaffRole", "expiresAt" timestamp, "acceptedAt" timestamp, "storeName" text) AS $$
  SELECT i.id, i."tenantId", i.email, i.role, i."expiresAt", i."acceptedAt", t.name
  FROM "StaffInvite" i JOIN "Tenant" t ON t.id = i."tenantId"
  WHERE i."tokenHash" = p_hash
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION resolve_invite_by_token_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_invite_by_token_hash(text) TO biztrack_app, biztrack_platform;
