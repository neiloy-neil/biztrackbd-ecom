-- Premium themes are bought one by one (49 BDT each) with a mobile-money payment that the platform checks, like a plan payment.
-- An approved row means the store owns that theme for life.
CREATE TABLE "ThemePurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "mfsProvider" "MfsProvider" NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThemePurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ThemePurchase_trxId_key" ON "ThemePurchase"("trxId");
CREATE INDEX "ThemePurchase_tenantId_themeId_idx" ON "ThemePurchase"("tenantId", "themeId");
CREATE INDEX "ThemePurchase_status_idx" ON "ThemePurchase"("status");
ALTER TABLE "ThemePurchase" ADD CONSTRAINT "ThemePurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThemePurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ThemePurchase" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "ThemePurchase";
CREATE POLICY tenant_isolation_policy ON "ThemePurchase" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

-- A store may claim a payment (insert) and read its own claims. It can never approve one, change it or delete it: only the platform role does.
REVOKE UPDATE, DELETE ON "ThemePurchase" FROM biztrack_app;
