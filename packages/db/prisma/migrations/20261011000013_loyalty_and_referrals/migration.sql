-- Phase 9: loyalty points, VIP tiers and referrals (docs/26). The loyalty tables already exist and are under row-level security.

ALTER TABLE "StoreSettings"
  ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "loyaltySpendPerPoint" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "loyaltyPointsPerBlock" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "loyaltyBdtPerBlock" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "loyaltyMaxCartPercent" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refereeDiscountBdt" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "refereeMinCartBdt" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "referrerRewardPoints" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "Order"
  ADD COLUMN "tierDiscountBdt" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "referralDiscountBdt" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "referralCode" TEXT;

-- A friend can be referred once; and one earn, one redeem and one bonus per order, so a repeated delivery cannot credit twice.
CREATE UNIQUE INDEX "CustomerReferral_tenantId_refereePhone_key" ON "CustomerReferral"("tenantId", "refereePhone");
CREATE UNIQUE INDEX "LoyaltyTransaction_accountId_orderId_type_key" ON "LoyaltyTransaction"("accountId", "orderId", "type");

-- Sanity limits the settings screen also enforces.
ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_loyalty_limits" CHECK (
    "loyaltySpendPerPoint" BETWEEN 1 AND 100000 AND "loyaltyPointsPerBlock" BETWEEN 1 AND 100000 AND "loyaltyBdtPerBlock" BETWEEN 1 AND 100000
    AND "loyaltyMaxCartPercent" BETWEEN 1 AND 100 AND "refereeDiscountBdt" BETWEEN 0 AND 100000 AND "refereeMinCartBdt" BETWEEN 0 AND 1000000 AND "referrerRewardPoints" BETWEEN 0 AND 1000000);

-- The points ledger: rows are never deleted by the app, and only the status (and the note) of a row can change. The amount,
-- the kind, the account and the order are fixed when the row is written, so a bug or a stolen session cannot rewrite history.
REVOKE DELETE ON "LoyaltyTransaction" FROM biztrack_app;
CREATE OR REPLACE FUNCTION loyalty_tx_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."points" IS DISTINCT FROM OLD."points" OR NEW."type" IS DISTINCT FROM OLD."type" OR NEW."accountId" IS DISTINCT FROM OLD."accountId"
     OR NEW."orderId" IS DISTINCT FROM OLD."orderId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'A loyalty ledger row cannot change its points, kind, account or order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER loyalty_tx_immutable BEFORE UPDATE ON "LoyaltyTransaction" FOR EACH ROW EXECUTE FUNCTION loyalty_tx_immutable();
