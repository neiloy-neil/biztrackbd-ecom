-- Emails and texts the platform sends to a store (docs/44): one row per message, so a reminder is never sent twice for the same moment.
CREATE TABLE "PlatformMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformMessage_tenantId_kind_channel_dedupeKey_key" ON "PlatformMessage"("tenantId", "kind", "channel", "dedupeKey");
CREATE INDEX "PlatformMessage_tenantId_createdAt_idx" ON "PlatformMessage"("tenantId", "createdAt");
ALTER TABLE "PlatformMessage" ADD CONSTRAINT "PlatformMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security like every table with a tenantId. The store's own login may record and read its own messages (the invite email is sent
-- from the store admin); the platform login bypasses it.
ALTER TABLE "PlatformMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformMessage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "PlatformMessage";
CREATE POLICY tenant_isolation_policy ON "PlatformMessage" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT ON "PlatformMessage" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformMessage" TO biztrack_platform;
