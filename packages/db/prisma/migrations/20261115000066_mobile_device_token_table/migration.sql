-- MobileDeviceToken is in schema.prisma and in production, but no migration ever created it, so migration 067 (row-level security on it)
-- failed on any new database. This migration sorts before 067 and creates the table exactly as production has it. On production it does nothing.
-- It also makes sure the three Supabase roles that later migrations grant to exist, so a plain Postgres (tests, CI, a new environment) can run them.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS "MobileDeviceToken" (
    "id" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "deviceModel" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileDeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MobileDeviceToken_pushToken_key" ON "MobileDeviceToken"("pushToken");
CREATE INDEX IF NOT EXISTS "MobileDeviceToken_tenantId_appType_idx" ON "MobileDeviceToken"("tenantId", "appType");
CREATE INDEX IF NOT EXISTS "MobileDeviceToken_userId_appType_idx" ON "MobileDeviceToken"("userId", "appType");
CREATE INDEX IF NOT EXISTS "MobileDeviceToken_appType_lastActiveAt_idx" ON "MobileDeviceToken"("appType", "lastActiveAt");
