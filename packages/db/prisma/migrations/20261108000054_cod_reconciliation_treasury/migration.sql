-- AlterTable CourierSettlementInvoice
ALTER TABLE "CourierSettlementInvoice" ADD COLUMN IF NOT EXISTS "bankTxnRef" TEXT;
ALTER TABLE "CourierSettlementInvoice" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "CourierSettlementInvoice" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;
ALTER TABLE "CourierSettlementInvoice" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CSV_IMPORT';

-- AlterTable CourierSettledOrder
ALTER TABLE "CourierSettledOrder" ADD COLUMN IF NOT EXISTS "toleranceApplied" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "CourierSettledOrder" ADD COLUMN IF NOT EXISTS "disputeNote" TEXT;
ALTER TABLE "CourierSettledOrder" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;

-- AlterTable StoreSettings
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "courierToleranceAmount" DECIMAL(12,2) NOT NULL DEFAULT 10.00;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "courierAutoRestockOnReturn" BOOLEAN NOT NULL DEFAULT false;
