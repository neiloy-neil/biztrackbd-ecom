-- A hand-made policy from before migration 56 is left on some databases. It is redundant with tenant_isolation_policy and trips the RLS audit.
DROP POLICY IF EXISTS site_lead_activity_isolation ON "SiteLeadActivity";
