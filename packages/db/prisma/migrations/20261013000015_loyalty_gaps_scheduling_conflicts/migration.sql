-- Phase 10: the loyalty gaps (expiry, level settings, birthday voucher, priority packing, a referral connection check),
-- scheduled pages and posts, and draft stamps for the editor.

ALTER TABLE "StoreSettings"
  ADD COLUMN "loyaltyExpiryMonths" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "vipSilverMin" INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN "vipGoldMin" INTEGER NOT NULL DEFAULT 15000,
  ADD COLUMN "vipPlatinumMin" INTEGER NOT NULL DEFAULT 35000,
  ADD COLUMN "vipGoldDiscount" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "vipPlatinumDiscount" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "birthdayVoucherBdt" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_vip_limits" CHECK (
  "loyaltyExpiryMonths" BETWEEN 0 AND 60 AND "vipSilverMin" >= 1 AND "vipGoldMin" > "vipSilverMin" AND "vipPlatinumMin" > "vipGoldMin" AND "vipPlatinumMin" <= 100000000
  AND "vipGoldDiscount" BETWEEN 0 AND 50 AND "vipPlatinumDiscount" BETWEEN "vipGoldDiscount" AND 50 AND "birthdayVoucherBdt" BETWEEN 0 AND 100000);

ALTER TABLE "Customer" ADD COLUMN "birthMonth" INTEGER, ADD COLUMN "birthDay" INTEGER;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_birthday_valid" CHECK (("birthMonth" IS NULL AND "birthDay" IS NULL) OR ("birthMonth" BETWEEN 1 AND 12 AND "birthDay" BETWEEN 1 AND 31));

ALTER TABLE "CustomerLoyaltyAccount" ADD COLUMN "birthdayVoucherYear" INTEGER;

ALTER TABLE "Order"
  ADD COLUMN "priorityPacking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clientHash" TEXT,
  ADD COLUMN "deliveryWaived" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Order_tenantId_clientHash_idx" ON "Order"("tenantId", "clientHash");

ALTER TABLE "Page" ADD COLUMN "publishAt" TIMESTAMP(3);
ALTER TABLE "BlogPost" ADD COLUMN "publishAt" TIMESTAMP(3);
ALTER TABLE "ThemeVersion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Stores that have a daily loyalty job to run (points that expire, birthday vouchers). Returns store ids only.
CREATE OR REPLACE FUNCTION tenants_with_loyalty_sweeps() RETURNS TABLE ("tenantId" text) AS $$
  SELECT s."tenantId" FROM "StoreSettings" s JOIN "Tenant" t ON t."id" = s."tenantId"
  WHERE s."loyaltyEnabled" AND (s."loyaltyExpiryMonths" > 0 OR s."birthdayVoucherBdt" > 0) AND t."status" IN ('TRIAL', 'ACTIVE', 'PAST_DUE');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_loyalty_sweeps() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_loyalty_sweeps() TO biztrack_app, biztrack_platform;
