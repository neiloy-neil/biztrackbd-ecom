-- Phase 10: real sign-in. Staff and the platform team sign in with Supabase Auth; these columns tie a Supabase account to the row.

ALTER TABLE "TenantUser" ADD COLUMN "authUserId" TEXT;
CREATE UNIQUE INDEX "TenantUser_tenantId_authUserId_key" ON "TenantUser"("tenantId", "authUserId");
CREATE INDEX "TenantUser_authUserId_idx" ON "TenantUser"("authUserId");

ALTER TABLE "PlatformUser" ADD COLUMN "authUserId" TEXT;
CREATE UNIQUE INDEX "PlatformUser_authUserId_key" ON "PlatformUser"("authUserId");

-- Which stores can this signed-in person work in? Called by the store admin after Supabase has confirmed who they are.
-- It must see across stores (the person is not in any store yet), so it is SECURITY DEFINER, and it returns only what the
-- store picker needs. A row not yet tied to an account is tied now if its email matches the CONFIRMED email the caller passes;
-- a row already tied to a different account is never touched, so a second account with the same email cannot take it over.
CREATE OR REPLACE FUNCTION staff_memberships(p_auth_id text, p_email text)
RETURNS TABLE ("userId" text, "tenantId" text, "subdomain" text, "storeName" text, "role" text, "name" text, "isActive" boolean, "tenantStatus" text) AS $$
BEGIN
  IF p_auth_id IS NULL OR length(p_auth_id) < 8 OR p_email IS NULL OR length(p_email) < 3 THEN RETURN; END IF;
  UPDATE "TenantUser" SET "authUserId" = p_auth_id, "updatedAt" = timezone('utc', now())
   WHERE "authUserId" IS NULL AND lower("email") = lower(p_email);
  RETURN QUERY
    SELECT u."id", u."tenantId", t."subdomain", t."name", u."role"::text, u."name", u."isActive", t."status"::text
      FROM "TenantUser" u JOIN "Tenant" t ON t."id" = u."tenantId"
     WHERE u."authUserId" = p_auth_id
     ORDER BY t."createdAt";
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION staff_memberships(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_memberships(text, text) TO biztrack_app;

-- Before we email a sign-in code to an address, check it belongs to someone on a team. Says only yes or no, and only to our
-- own servers (the store admin), so the sign-in page cannot be used to spam strangers or to list who has an account.
CREATE OR REPLACE FUNCTION staff_email_known(p_email text) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "TenantUser" WHERE lower("email") = lower(p_email) AND "isActive");
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION staff_email_known(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_email_known(text) TO biztrack_app;
