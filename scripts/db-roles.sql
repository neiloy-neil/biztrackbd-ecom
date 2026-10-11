-- Sets the passwords for the two database roles created by the RLS migration. Run once per environment as the
-- database owner, with real values substituted. Never commit real passwords; this file is a template.
--
--   psql "$DIRECT_URL" -v app_pw="'<generated>'" -v platform_pw="'<generated>'" -f scripts/db-roles.sql
--
-- biztrack_app       NOBYPASSRLS. The storefront and admin connect as this role (DATABASE_URL).
-- biztrack_platform  BYPASSRLS.   Only the super admin app connects as this role (PLATFORM_DATABASE_URL).

ALTER ROLE biztrack_app LOGIN PASSWORD :app_pw;
ALTER ROLE biztrack_platform LOGIN PASSWORD :platform_pw;

-- Sanity checks: both lines must show the expected values.
SELECT rolname, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname IN ('biztrack_app', 'biztrack_platform');
