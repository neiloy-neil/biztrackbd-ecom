-- Phase 5: signup, billing and super admin.
-- AlterTable
ALTER TABLE "PaymentProof" ADD COLUMN     "appliedFrom" TIMESTAMP(3),
ADD COLUMN     "appliedTo" TIMESTAMP(3),
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "quarantineReason" TEXT,
ADD COLUMN     "quarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;


CREATE INDEX "Tenant_ownerEmail_idx" ON "Tenant"(lower("ownerEmail"));

-- A stranger signing up has no store yet, so the restricted app role cannot insert the Tenant row (its policy is "id = current store").
-- These two functions are the only way in. They validate everything the database can know and return nothing but a yes or an id.
CREATE OR REPLACE FUNCTION signup_subdomain_taken(p_subdomain text) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "Tenant" WHERE subdomain = lower(p_subdomain))
      OR EXISTS (SELECT 1 FROM "Domain" WHERE domain = lower(p_subdomain));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION signup_create_tenant(
  p_id text, p_name text, p_subdomain text, p_theme text, p_plan "PlanTier", p_owner_name text, p_owner_email text, p_owner_phone text,
  p_trial_days int, p_quarantined boolean, p_quarantine_reason text, p_max_per_email int
) RETURNS text AS $$
DECLARE existing int;
BEGIN
  IF p_trial_days < 0 OR p_trial_days > 60 THEN RAISE EXCEPTION 'bad trial length'; END IF;
  SELECT count(*) INTO existing FROM "Tenant" WHERE lower("ownerEmail") = lower(p_owner_email) AND status <> 'CANCELLED';
  IF existing >= p_max_per_email THEN RAISE EXCEPTION 'too many stores for this email' USING ERRCODE = 'P0003'; END IF;
  IF signup_subdomain_taken(p_subdomain) THEN RAISE EXCEPTION 'subdomain taken' USING ERRCODE = 'P0002'; END IF;
  -- Prisma stores UTC in these timestamp columns, so write UTC here whatever the server's time zone is.
  INSERT INTO "Tenant" (id, name, subdomain, "themeId", "planTier", status, "trialStartsAt", "trialEndsAt", "ownerName", "ownerEmail", "ownerPhone", quarantined, "quarantineReason", "createdAt", "updatedAt")
  VALUES (p_id, p_name, lower(p_subdomain), p_theme, p_plan, 'TRIAL', timezone('utc', now()), timezone('utc', now()) + make_interval(days => p_trial_days), p_owner_name, lower(p_owner_email), p_owner_phone, p_quarantined, p_quarantine_reason, timezone('utc', now()), timezone('utc', now()));
  RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION signup_subdomain_taken(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION signup_create_tenant(text, text, text, text, "PlanTier", text, text, text, int, boolean, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION signup_subdomain_taken(text) TO biztrack_app, biztrack_platform;
GRANT EXECUTE ON FUNCTION signup_create_tenant(text, text, text, text, "PlanTier", text, text, text, int, boolean, text, int) TO biztrack_app, biztrack_platform;

-- A store can ask to be billed (insert a payment proof) and read what it owes, but it can never approve its own payment or
-- change its own subscription: those are written only by the platform role.
REVOKE UPDATE ON "PaymentProof" FROM biztrack_app;
REVOKE UPDATE, DELETE ON "Subscription" FROM biztrack_app;
