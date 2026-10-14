-- CreateTable: SubscriptionPromo
CREATE TABLE "SubscriptionPromo" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "applicableTiers" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "billingInterval" TEXT NOT NULL DEFAULT 'ANY',
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPromo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPromo_code_key" ON "SubscriptionPromo"("code");
CREATE INDEX "SubscriptionPromo_code_isActive_idx" ON "SubscriptionPromo"("code", "isActive");

-- CreateTable: TenantQuotaAdjustment
CREATE TABLE "TenantQuotaAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantQuotaAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantQuotaAdjustment_tenantId_createdAt_idx" ON "TenantQuotaAdjustment"("tenantId", "createdAt");

ALTER TABLE "TenantQuotaAdjustment" ADD CONSTRAINT "TenantQuotaAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security and Permissions
REVOKE ALL ON "SubscriptionPromo" FROM biztrack_app;
GRANT SELECT ON "SubscriptionPromo" TO biztrack_app;
GRANT ALL ON "SubscriptionPromo" TO biztrack_platform;

ALTER TABLE "TenantQuotaAdjustment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TenantQuotaAdjustment"
    FOR ALL
    TO biztrack_app
    USING ("tenantId" = current_tenant())
    WITH CHECK ("tenantId" = current_tenant());

GRANT ALL ON "TenantQuotaAdjustment" TO biztrack_platform, biztrack_app;
