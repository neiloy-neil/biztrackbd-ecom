-- Paid add-on modules: a price list the platform edits, purchases the platform approves, and an end date on a module a store bought monthly.
ALTER TABLE "TenantModule" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "TenantModule" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'PLAN';

CREATE TABLE "ModulePrice" (
    "moduleKey" TEXT NOT NULL,
    "priceModel" TEXT NOT NULL DEFAULT 'FREE',
    "priceBdt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellable" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModulePrice_pkey" PRIMARY KEY ("moduleKey")
);

-- Platform table: stores read the price list, only the platform role writes.
ALTER TABLE "ModulePrice" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moduleprice_read_by_store_apps ON "ModulePrice";
CREATE POLICY moduleprice_read_by_store_apps ON "ModulePrice" FOR SELECT TO biztrack_app USING (true);
REVOKE ALL ON "ModulePrice" FROM biztrack_app;
GRANT SELECT ON "ModulePrice" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ModulePrice" TO biztrack_platform;

CREATE TABLE "ModulePurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "mfsProvider" "MfsProvider" NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModulePurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModulePurchase_trxId_key" ON "ModulePurchase"("trxId");
CREATE INDEX "ModulePurchase_tenantId_moduleKey_idx" ON "ModulePurchase"("tenantId", "moduleKey");
CREATE INDEX "ModulePurchase_status_idx" ON "ModulePurchase"("status");
ALTER TABLE "ModulePurchase" ADD CONSTRAINT "ModulePurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModulePurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModulePurchase" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "ModulePurchase";
CREATE POLICY tenant_isolation_policy ON "ModulePurchase" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

-- A store may claim a payment (insert) and read its own claims. It can never approve one, change it or delete it: only the platform role does.
REVOKE UPDATE, DELETE ON "ModulePurchase" FROM biztrack_app;
