-- Phase 7: store design versions, landing pages and automatic domain checks.

-- A landing page is not live until its layout is published from the editor.
ALTER TABLE "LandingPage" ALTER COLUMN "isPublished" SET DEFAULT false;

-- Domains the platform should look at: not yet connected and claimed within the last 7 days, or connected but still waiting for
-- the certificate. Checked at most every 2 minutes each. Returns store ids and host names only, for the scheduled job.
CREATE OR REPLACE FUNCTION domains_to_check()
RETURNS TABLE ("tenantId" text, "domain" text) AS $$
  SELECT d."tenantId", d."domain" FROM "Domain" d
  WHERE (
      (d."verified" = false AND d."createdAt" > timezone('utc', now()) - interval '7 days')
      OR (d."verified" = true AND d."sslStatus" <> 'issued')
    )
    AND (d."lastCheckedAt" IS NULL OR d."lastCheckedAt" < timezone('utc', now()) - interval '2 minutes')
  ORDER BY d."lastCheckedAt" NULLS FIRST
  LIMIT 200;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION domains_to_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domains_to_check() TO biztrack_app, biztrack_platform;
