-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MarketingCampaign_tenantId_status_scheduledFor_idx" ON "MarketingCampaign"("tenantId", "status", "scheduledFor");
