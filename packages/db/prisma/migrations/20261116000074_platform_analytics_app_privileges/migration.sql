-- The marketing site records visits and browser errors as the restricted app role (migration 064), the same role the store apps use. The
-- default privileges from migration 002 gave that role full access to these three tables, more than 064 meant to grant. What the code
-- actually does as the app role: read and create sessions and errors, update a session or an error's counters, and only ever create events.
-- Nothing deletes from these tables as any role. So: no DELETE anywhere, and no UPDATE on events. SELECT stays: an INSERT that returns the new
-- row needs it, and the lookups (find a session, find an existing error) need it.
REVOKE DELETE ON "PlatformVisitorSession", "PlatformVisitorEvent", "PlatformClientError" FROM biztrack_app;
REVOKE UPDATE ON "PlatformVisitorEvent" FROM biztrack_app;
