-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN     "upazila" TEXT;

-- AlterTable
ALTER TABLE "ShippingZone" ADD COLUMN     "etaMaxDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "etaMinDays" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "tagline" TEXT,
    "contactPhone" TEXT,
    "whatsappNumber" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "addressLine" TEXT,
    "logoUrl" TEXT,
    "announcement" TEXT,
    "announcementBn" TEXT,
    "bkashNumber" TEXT,
    "bkashKind" TEXT NOT NULL DEFAULT 'PERSONAL',
    "nagadNumber" TEXT,
    "nagadKind" TEXT NOT NULL DEFAULT 'PERSONAL',
    "paymentNote" TEXT,
    "offlineMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOtp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_tenantId_key" ON "StoreSettings"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerOtp_tenantId_phone_createdAt_idx" ON "CustomerOtp"("tenantId", "phone", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerOtp_expiresAt_idx" ON "CustomerOtp"("expiresAt");

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOtp" ADD CONSTRAINT "CustomerOtp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security for the new tenant tables (same policy as every other tenant table, see the rls migration).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['StoreSettings', 'CustomerOtp'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "StoreSettings", "CustomerOtp" TO biztrack_app, biztrack_platform;
