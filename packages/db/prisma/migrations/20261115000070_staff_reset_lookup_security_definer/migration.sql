-- Secure RPC to resolve staff and merchant owners for password reset across tenants
-- Runs with SECURITY DEFINER to bypass Row-Level Security (RLS) when an unauthenticated
-- merchant or store manager is looking up their account by email or mobile phone.

CREATE OR REPLACE FUNCTION staff_reset_lookup(p_identifier text)
RETURNS TABLE (
  account_email text,
  account_phone text,
  store_name text,
  tenant_status text,
  subdomain text,
  user_name text,
  role text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := trim(p_identifier);
  v_digits text := regexp_replace(v_clean, '\D', '', 'g');
  v_phone text := NULL;
BEGIN
  IF v_clean = '' THEN
    RETURN;
  END IF;

  IF length(v_digits) >= 10 THEN
    v_phone := right(v_digits, 11);
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    q.account_email,
    q.account_phone,
    q.store_name,
    q.tenant_status,
    q.subdomain,
    q.user_name,
    q.role,
    q.is_active
  FROM (
    -- 1. Matching TenantUser records
    SELECT
      lower(tu.email)::text AS account_email,
      tu.phone::text AS account_phone,
      t.name::text AS store_name,
      t.status::text AS tenant_status,
      t.subdomain::text AS subdomain,
      tu.name::text AS user_name,
      tu.role::text AS role,
      tu."isActive" AS is_active
    FROM "TenantUser" tu
    JOIN "Tenant" t ON tu."tenantId" = t.id
    WHERE tu."isActive" = true
      AND t.status != 'CANCELLED'
      AND (
        (v_clean LIKE '%@%' AND lower(tu.email) = lower(v_clean))
        OR
        (v_phone IS NOT NULL AND right(regexp_replace(COALESCE(tu.phone, ''), '\D', '', 'g'), 11) = v_phone)
      )

    UNION ALL

    -- 2. Matching Tenant owner records
    SELECT
      lower(t."ownerEmail")::text AS account_email,
      t."ownerPhone"::text AS account_phone,
      t.name::text AS store_name,
      t.status::text AS tenant_status,
      t.subdomain::text AS subdomain,
      COALESCE(t."ownerName", 'Store Owner')::text AS user_name,
      'STORE_OWNER'::text AS role,
      true AS is_active
    FROM "Tenant" t
    WHERE t.status != 'CANCELLED'
      AND t."ownerEmail" IS NOT NULL
      AND (
        (v_clean LIKE '%@%' AND lower(t."ownerEmail") = lower(v_clean))
        OR
        (v_phone IS NOT NULL AND right(regexp_replace(COALESCE(t."ownerPhone", ''), '\D', '', 'g'), 11) = v_phone)
      )
  ) q;
END;
$$;

GRANT EXECUTE ON FUNCTION staff_reset_lookup(text) TO authenticated, anon, service_role, biztrack_app, biztrack_platform, postgres;
