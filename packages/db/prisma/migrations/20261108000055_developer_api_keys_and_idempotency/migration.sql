-- AlterTable ApiKeyCredential
ALTER TABLE "ApiKeyCredential" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'LIVE';
ALTER TABLE "ApiKeyCredential" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "ApiKeyCredential" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateUniqueIndex for hashedToken
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKeyCredential_hashedToken_key" ON "ApiKeyCredential"("hashedToken");
CREATE INDEX IF NOT EXISTS "ApiKeyCredential_tenantId_isActive_idx" ON "ApiKeyCredential"("tenantId", "isActive");

-- CreateTable ApiIdempotencyRecord
CREATE TABLE IF NOT EXISTS "ApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiIdempotencyRecord_tenantId_idempotencyKey_key" ON "ApiIdempotencyRecord"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ApiIdempotencyRecord_expiresAt_idx" ON "ApiIdempotencyRecord"("expiresAt");

-- AddForeignKey
ALTER TABLE "ApiIdempotencyRecord" DROP CONSTRAINT IF EXISTS "ApiIdempotencyRecord_tenantId_fkey";
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ApiRequestLog
CREATE TABLE IF NOT EXISTS "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "keyPrefix" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiRequestLog_tenantId_createdAt_idx" ON "ApiRequestLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApiRequestLog" DROP CONSTRAINT IF EXISTS "ApiRequestLog_tenantId_fkey";
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiRequestLog" DROP CONSTRAINT IF EXISTS "ApiRequestLog_apiKeyId_fkey";
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKeyCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security for ApiIdempotencyRecord and ApiRequestLog
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ApiIdempotencyRecord',
    'ApiRequestLog'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO biztrack_app', tbl);
  END LOOP;
END $$;
