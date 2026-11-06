-- Advance payment before a cash-on-delivery order is accepted. Additive only: the previous version of the code keeps working against this schema.
ALTER TABLE "StoreSettings" ADD COLUMN "advanceMode" TEXT NOT NULL DEFAULT 'OFF';
ALTER TABLE "StoreSettings" ADD COLUMN "advanceValue" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "StoreSettings" ADD COLUMN "advanceMinOrder" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "StoreSettings" ADD COLUMN "advancePayVia" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "StoreSettings" ADD COLUMN "advanceWindowHours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "Order" ADD COLUMN "advanceRequiredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "Order" ADD COLUMN "advanceDueAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "advanceMethod" "PaymentMethodType";

-- Stores with orders whose advance was not paid by the deadline, for the expiry sweep. Returns store ids only.
-- An order whose customer already sent a TrxID (PENDING_VERIFICATION) is never listed: that person has paid and is waiting for the owner.
-- FAILED (the owner said the payment never arrived) is listed, so such an order does not hold stock for ever.
CREATE OR REPLACE FUNCTION tenants_with_expired_advance_orders()
RETURNS TABLE ("tenantId" text) AS $$
  SELECT DISTINCT o."tenantId" FROM "Order" o
  WHERE o."deletedAt" IS NULL AND o.status = 'PENDING' AND o."paymentStatus" IN ('UNPAID', 'FAILED')
    AND o."advanceRequiredAmount" > 0 AND o."advancePaidAmount" < o."advanceRequiredAmount"
    AND o."advanceDueAt" IS NOT NULL AND o."advanceDueAt" < timezone('utc', now());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_expired_advance_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_expired_advance_orders() TO biztrack_app, biztrack_platform;
