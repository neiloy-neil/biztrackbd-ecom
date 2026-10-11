-- Supabase switches row-level security on for every new table by itself (an event trigger named ensure_rls). A table with RLS on and no
-- policy shows no rows to anyone but the table's owner and roles that bypass RLS. Two platform tables are meant to be readable by the
-- store apps (their role, biztrack_app, was granted SELECT in migration 2): the public price list and the platform's announcements.
-- Without these policies the signup page and the billing screen see an empty price list on Supabase. On plain Postgres (RLS off on
-- these tables) the policies change nothing. Writes stay with biztrack_platform, which bypasses row-level security.
CREATE POLICY plan_read_by_store_apps ON "Plan" FOR SELECT TO biztrack_app USING (true);
CREATE POLICY announcement_read_by_store_apps ON "Announcement" FOR SELECT TO biztrack_app USING (true);
