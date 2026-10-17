-- CreateTable NotificationJob (NOTIFY-001)
CREATE TABLE IF NOT EXISTS "NotificationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationJob_tenantId_status_nextRetryAt_idx" ON "NotificationJob"("tenantId", "status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "NotificationJob_status_nextRetryAt_idx" ON "NotificationJob"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "NotificationJob_tenantId_createdAt_idx" ON "NotificationJob"("tenantId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Row Level Security (RLS) Policies
ALTER TABLE "NotificationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_job_tenant_policy ON "NotificationJob";
CREATE POLICY notification_job_tenant_policy ON "NotificationJob" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationJob" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationJob" TO biztrack_platform;
