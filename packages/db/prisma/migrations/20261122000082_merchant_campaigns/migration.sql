-- Merchant CRM, phase 4: campaigns to store owners, automatic nudges, and a marketing opt-out. All platform-only except the opt-out flag, which the owner sets in store settings.
ALTER TABLE "StoreSettings" ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "marketingOptOutAt" TIMESTAMP(3);

CREATE TABLE "MerchantCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "filterKey" TEXT NOT NULL,
    "segmentName" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "testedAt" TIMESTAMP(3),
    "testHash" TEXT,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MerchantCampaign_status_createdAt_idx" ON "MerchantCampaign"("status", "createdAt");
CREATE INDEX "MerchantCampaign_filterKey_sentAt_idx" ON "MerchantCampaign"("filterKey", "sentAt");
REVOKE ALL ON "MerchantCampaign" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MerchantCampaign" TO biztrack_platform;

CREATE TABLE "MerchantCampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantCampaignSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MerchantCampaignSend_campaignId_tenantId_key" ON "MerchantCampaignSend"("campaignId", "tenantId");
CREATE INDEX "MerchantCampaignSend_tenantId_idx" ON "MerchantCampaignSend"("tenantId");
ALTER TABLE "MerchantCampaignSend" ADD CONSTRAINT "MerchantCampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MerchantCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantCampaignSend" ADD CONSTRAINT "MerchantCampaignSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
REVOKE ALL ON "MerchantCampaignSend" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MerchantCampaignSend" TO biztrack_platform;
ALTER TABLE "MerchantCampaignSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MerchantCampaignSend" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "MerchantCampaignSend";
CREATE POLICY tenant_isolation_policy ON "MerchantCampaignSend" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

CREATE TABLE "PlatformAutomation" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAutomation_pkey" PRIMARY KEY ("key")
);
REVOKE ALL ON "PlatformAutomation" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformAutomation" TO biztrack_platform;
