-- Phase 6: abandoned checkouts, tracking and reviews.
-- AlterTable
ALTER TABLE "AbandonedCheckout" ADD COLUMN     "district" TEXT,
ADD COLUMN     "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "recoveryToken" TEXT,
ADD COLUMN     "smsClaimedAt" TIMESTAMP(3),
ADD COLUMN     "smsSentAt" TIMESTAMP(3),
ADD COLUMN     "smsStatus" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "abandonedSmsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metaPixelId" TEXT,
ADD COLUMN     "reviewsAutoPublish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrackingEvent" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "httpStatus" INTEGER,
ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCheckout_recoveryToken_key" ON "AbandonedCheckout"("recoveryToken");

-- CreateIndex
CREATE UNIQUE INDEX "Review_tenantId_productId_customerId_key" ON "Review"("tenantId", "productId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEvent_tenantId_provider_eventId_origin_key" ON "TrackingEvent"("tenantId", "provider", "eventId", "origin");


-- One live checkout per phone number per store: a customer who comes back updates their row instead of adding another to the call list.
CREATE UNIQUE INDEX "AbandonedCheckout_one_open_per_phone" ON "AbandonedCheckout"("tenantId", "phone") WHERE status IN ('CAPTURED', 'CALL_SCHEDULED', 'CALL_CONNECTED');

-- Stores with an abandoned checkout waiting for its recovery SMS, for the sweep. Returns store ids only.
CREATE OR REPLACE FUNCTION tenants_with_pending_recovery()
RETURNS TABLE ("tenantId" text) AS $$
  SELECT DISTINCT a."tenantId" FROM "AbandonedCheckout" a
  WHERE a.status = 'CAPTURED' AND a."smsClaimedAt" IS NULL AND a."lastEventAt" < timezone('utc', now()) - interval '30 minutes' AND a."lastEventAt" > timezone('utc', now()) - interval '3 days';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_pending_recovery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_pending_recovery() TO biztrack_app, biztrack_platform;
