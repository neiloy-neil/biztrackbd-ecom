-- Staff notifications: who gets an email when something happens on the platform, and a feed of what happened.
CREATE TABLE "PlatformNotifyRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformNotifyRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformNotifyRecipient_email_key" ON "PlatformNotifyRecipient"("email");

CREATE TABLE "PlatformNotification" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformNotification_createdAt_idx" ON "PlatformNotification"("createdAt");

-- Platform-only tables: no policy and no grant for the store-app role. Row-level security is on so nothing leaks if a grant is added later.
ALTER TABLE "PlatformNotifyRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformNotification" ENABLE ROW LEVEL SECURITY;

-- The marketing and store apps run as the restricted role, which cannot touch those tables. These two functions are the only way in:
-- one writes a feed entry (and nothing else), the other returns the addresses that want a given kind of event.
CREATE OR REPLACE FUNCTION platform_notify_record(p_kind text, p_title text, p_body text, p_meta jsonb) RETURNS text AS $$
DECLARE new_id text := 'ntf_' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF p_kind NOT IN ('SIGNUP', 'INQUIRY', 'PAYMENT_PROOF', 'TICKET', 'TEST') THEN RAISE EXCEPTION 'unknown notification kind'; END IF;
  INSERT INTO "PlatformNotification" (id, kind, title, body, meta)
  VALUES (new_id, p_kind, left(p_title, 200), left(p_body, 4000), coalesce(p_meta, '{}'::jsonb));
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION platform_notify_recipients(p_kind text) RETURNS text[] AS $$
  SELECT coalesce(array_agg(email ORDER BY email), ARRAY[]::text[]) FROM "PlatformNotifyRecipient" WHERE active AND p_kind = ANY (events);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION platform_notify_record(text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_notify_recipients(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_notify_record(text, text, text, jsonb) TO biztrack_app, biztrack_platform;
GRANT EXECUTE ON FUNCTION platform_notify_recipients(text) TO biztrack_app, biztrack_platform;
