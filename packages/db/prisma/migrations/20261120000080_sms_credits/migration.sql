-- Prepaid SMS packs: a store buys SMS by mobile money, the platform checks the TrxID, and the quantity is added to the store's prepaid balance.
CREATE TABLE "SmsPurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
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
    CONSTRAINT "SmsPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SmsPurchase_trxId_key" ON "SmsPurchase"("trxId");
CREATE INDEX "SmsPurchase_tenantId_idx" ON "SmsPurchase"("tenantId");
CREATE INDEX "SmsPurchase_status_idx" ON "SmsPurchase"("status");
ALTER TABLE "SmsPurchase" ADD CONSTRAINT "SmsPurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SmsPurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmsPurchase" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "SmsPurchase";
CREATE POLICY tenant_isolation_policy ON "SmsPurchase" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

-- A store may claim a payment (insert) and read its own claims. It can never approve one, change it or delete it: only the platform role does.
REVOKE UPDATE, DELETE ON "SmsPurchase" FROM biztrack_app;

-- Monthly SMS included in each plan: Starter 100, Pro 500. Larger plans are left as they are.
UPDATE "Plan" SET "limits" = jsonb_set("limits"::jsonb, '{smsCredits}', '100'::jsonb) WHERE "tier" = 'STARTER';
UPDATE "Plan" SET "limits" = jsonb_set("limits"::jsonb, '{smsCredits}', '500'::jsonb) WHERE "tier" = 'PRO';
