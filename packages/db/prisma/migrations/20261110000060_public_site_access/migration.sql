-- The marketing site connects with the store-app role (biztrack_app), which has no access to the platform tables. Two narrow openings:
--
-- 1. It may READ only the settings meant to be public: the contact details and SEO text saved in Platform Admin. Every other row in
--    PlatformConfig (API keys, secrets) stays invisible: row-level security hides it, the grant alone shows nothing.
-- 2. It may ADD an inquiry from the public contact form, and nothing else: no reading, changing or deleting inquiries.
GRANT SELECT ON "PlatformConfig" TO biztrack_app;
DROP POLICY IF EXISTS platform_config_public_read ON "PlatformConfig";
CREATE POLICY platform_config_public_read ON "PlatformConfig" FOR SELECT TO biztrack_app
  USING (key LIKE 'contact\_%' OR key LIKE 'platform\_seo\_%' OR key = 'google_site_verification');

GRANT INSERT ON "PlatformInquiry" TO biztrack_app;
DROP POLICY IF EXISTS platform_inquiry_public_insert ON "PlatformInquiry";
CREATE POLICY platform_inquiry_public_insert ON "PlatformInquiry" FOR INSERT TO biztrack_app WITH CHECK (true);
