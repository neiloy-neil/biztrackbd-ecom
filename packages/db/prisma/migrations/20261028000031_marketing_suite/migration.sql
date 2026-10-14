-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetSegment" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingCampaign_tenantId_createdAt_idx" ON "MarketingCampaign"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "flashSaleActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "flashSaleEndsAt" TIMESTAMP(3),
ADD COLUMN "flashSaleCoupon" TEXT;
