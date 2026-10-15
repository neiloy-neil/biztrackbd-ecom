-- Migration: 20261102000044_affiliate_and_influencer_hub
-- Adds Affiliate & Influencer Commission Hub models, store settings, and RLS tenant isolation

ALTER TABLE "StoreSettings"
  ADD COLUMN IF NOT EXISTS "affiliateEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "affiliateDefaultType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN IF NOT EXISTS "affiliateDefaultRate" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS "affiliateMinPayoutBdt" DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS "affiliateCookieDays" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS "AffiliatePartner" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "couponCode" TEXT,
  "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "payoutMethod" TEXT NOT NULL DEFAULT 'BKASH',
  "payoutAccount" TEXT,
  "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  "payableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  "portalToken" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliatePartner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliatePartner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliatePartner_tenantId_code_key" ON "AffiliatePartner"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliatePartner_portalToken_key" ON "AffiliatePartner"("portalToken");
CREATE INDEX IF NOT EXISTS "AffiliatePartner_tenantId_status_idx" ON "AffiliatePartner"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "AffiliateReferral" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "orderSubtotal" DECIMAL(12,2) NOT NULL,
  "commissionAmount" DECIMAL(12,2) NOT NULL,
  "commissionType" TEXT NOT NULL,
  "commissionValue" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attributedVia" TEXT NOT NULL DEFAULT 'LINK',
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateReferral_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliatePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AffiliateReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AffiliateReferral_tenantId_affiliateId_idx" ON "AffiliateReferral"("tenantId", "affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliateReferral_tenantId_orderId_idx" ON "AffiliateReferral"("tenantId", "orderId");
CREATE INDEX IF NOT EXISTS "AffiliateReferral_tenantId_status_idx" ON "AffiliateReferral"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "AffiliatePayout" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankDetails" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "trxId" TEXT,
  "notes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliatePayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliatePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AffiliatePayout_tenantId_affiliateId_idx" ON "AffiliatePayout"("tenantId", "affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliatePayout_tenantId_status_idx" ON "AffiliatePayout"("tenantId", "status");

-- RLS
ALTER TABLE "AffiliatePartner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateReferral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliatePayout" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AffiliatePartner' AND policyname = 'affiliate_partner_tenant_isolation'
  ) THEN
    CREATE POLICY "affiliate_partner_tenant_isolation" ON "AffiliatePartner"
      USING ("tenantId" = current_setting('app.current_tenant_id', true))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AffiliateReferral' AND policyname = 'affiliate_referral_tenant_isolation'
  ) THEN
    CREATE POLICY "affiliate_referral_tenant_isolation" ON "AffiliateReferral"
      USING ("tenantId" = current_setting('app.current_tenant_id', true))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AffiliatePayout' AND policyname = 'affiliate_payout_tenant_isolation'
  ) THEN
    CREATE POLICY "affiliate_payout_tenant_isolation" ON "AffiliatePayout"
      USING ("tenantId" = current_setting('app.current_tenant_id', true))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AffiliatePartner" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AffiliateReferral" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AffiliatePayout" TO biztrack_app;
