-- Phase 4: couriers, fraud trust, returns, COD settlement and profit.
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "storeCredit" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierBookedAt" TIMESTAMP(3),
ADD COLUMN     "courierBookingLock" TIMESTAMP(3),
ADD COLUMN     "courierStatus" TEXT,
ADD COLUMN     "courierStatusAt" TIMESTAMP(3),
ADD COLUMN     "courierSyncedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "fraudReview" TEXT,
ADD COLUMN     "refusedAtDoor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "trustRecorded" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "exchangeReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "refundMethod" TEXT,
ADD COLUMN     "refundTrxId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "restocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnTrackingCode" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "courierCodFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
ADD COLUMN     "courierFeeInsideDhaka" DECIMAL(12,2) NOT NULL DEFAULT 70.00,
ADD COLUMN     "courierFeeOutsideDhaka" DECIMAL(12,2) NOT NULL DEFAULT 130.00,
ADD COLUMN     "defaultCourier" TEXT;

-- CreateTable
CREATE TABLE "CourierEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "orderId" TEXT,
    "consignmentId" TEXT,
    "status" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEBHOOK',
    "result" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneTrustEvent" (
    "phoneHash" TEXT NOT NULL,
    "orderKey" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneTrustEvent_pkey" PRIMARY KEY ("phoneHash","orderKey")
);

-- CreateIndex
CREATE INDEX "CourierEvent_tenantId_orderId_idx" ON "CourierEvent"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "CourierEvent_tenantId_createdAt_idx" ON "CourierEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourierEvent_tenantId_provider_dedupeKey_key" ON "CourierEvent"("tenantId", "provider", "dedupeKey");

-- CreateIndex
CREATE INDEX "PhoneTrustEvent_phoneHash_occurredAt_idx" ON "PhoneTrustEvent"("phoneHash", "occurredAt");

-- CreateIndex
CREATE INDEX "Order_tenantId_status_courierSyncedAt_idx" ON "Order"("tenantId", "status", "courierSyncedAt");

-- AddForeignKey
ALTER TABLE "CourierEvent" ADD CONSTRAINT "CourierEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierEvent" ADD CONSTRAINT "CourierEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---- Row-level security for the new tenant table
ALTER TABLE "CourierEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourierEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "CourierEvent";
CREATE POLICY tenant_isolation_policy ON "CourierEvent" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "CourierEvent" TO biztrack_app, biztrack_platform;
-- The courier log is append-only for the application role.
REVOKE UPDATE, DELETE ON "CourierEvent" FROM biztrack_app;
DROP TRIGGER IF EXISTS trg_tenant_fk_CourierEvent_orderId ON "CourierEvent";
CREATE TRIGGER trg_tenant_fk_CourierEvent_orderId BEFORE INSERT OR UPDATE ON "CourierEvent" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('Order', 'orderId');

-- ---- Cross-store delivery trust (docs/12 section 1). Platform table: the app role gets no direct access at all.
REVOKE ALL ON "PhoneTrustEvent" FROM biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PhoneTrustEvent" TO biztrack_platform;

-- Records (or corrects) one delivery outcome and refreshes the aggregate row. Takes only hashes.
CREATE OR REPLACE FUNCTION phone_trust_record(p_phone_hash text, p_order_key text, p_store_key text, p_kind text, p_at timestamptz)
RETURNS void AS $$
BEGIN
  IF p_kind NOT IN ('DELIVERED', 'RETURNED', 'REFUSED') THEN RAISE EXCEPTION 'bad kind'; END IF;
  IF length(p_phone_hash) <> 64 OR length(p_order_key) <> 64 OR length(p_store_key) <> 64 THEN RAISE EXCEPTION 'bad hash'; END IF;
  INSERT INTO "PhoneTrustEvent" ("phoneHash", "orderKey", "storeKey", kind, "occurredAt")
  VALUES (p_phone_hash, p_order_key, p_store_key, p_kind, p_at)
  ON CONFLICT ("phoneHash", "orderKey") DO UPDATE SET kind = EXCLUDED.kind, "occurredAt" = EXCLUDED."occurredAt";
  INSERT INTO "PhoneTrustStat" ("phoneHash", delivered, returned, refused, "storesSeen", "lastEventAt", "updatedAt")
  SELECT "phoneHash", count(*) FILTER (WHERE kind = 'DELIVERED'), count(*) FILTER (WHERE kind = 'RETURNED'),
         count(*) FILTER (WHERE kind = 'REFUSED'), count(DISTINCT "storeKey"), max("occurredAt"), now()
  FROM "PhoneTrustEvent" WHERE "phoneHash" = p_phone_hash GROUP BY "phoneHash"
  ON CONFLICT ("phoneHash") DO UPDATE SET delivered = EXCLUDED.delivered, returned = EXCLUDED.returned, refused = EXCLUDED.refused,
    "storesSeen" = EXCLUDED."storesSeen", "lastEventAt" = EXCLUDED."lastEventAt", "updatedAt" = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Counts only, grouped by age, for one hashed number. Never returns rows.
CREATE OR REPLACE FUNCTION phone_trust_lookup(p_phone_hash text)
RETURNS TABLE (delivered30 int, delivered90 int, "deliveredOld" int, failed30 int, failed90 int, "failedOld" int, refused60 int, stores int) AS $$
  SELECT
    count(*) FILTER (WHERE kind = 'DELIVERED' AND "occurredAt" >= now() - interval '30 days')::int,
    count(*) FILTER (WHERE kind = 'DELIVERED' AND "occurredAt" < now() - interval '30 days' AND "occurredAt" >= now() - interval '90 days')::int,
    count(*) FILTER (WHERE kind = 'DELIVERED' AND "occurredAt" < now() - interval '90 days')::int,
    count(*) FILTER (WHERE kind <> 'DELIVERED' AND "occurredAt" >= now() - interval '30 days')::int,
    count(*) FILTER (WHERE kind <> 'DELIVERED' AND "occurredAt" < now() - interval '30 days' AND "occurredAt" >= now() - interval '90 days')::int,
    count(*) FILTER (WHERE kind <> 'DELIVERED' AND "occurredAt" < now() - interval '90 days')::int,
    count(*) FILTER (WHERE kind = 'REFUSED' AND "occurredAt" >= now() - interval '60 days')::int,
    count(DISTINCT "storeKey")::int
  FROM "PhoneTrustEvent" WHERE "phoneHash" = p_phone_hash;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION phone_trust_record(text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION phone_trust_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION phone_trust_record(text, text, text, text, timestamptz) TO biztrack_app, biztrack_platform;
GRANT EXECUTE ON FUNCTION phone_trust_lookup(text) TO biztrack_app, biztrack_platform;

-- ---- Stores that have parcels out with an API courier, for the 30-minute status sync. Returns store ids only.
CREATE OR REPLACE FUNCTION tenants_with_open_parcels()
RETURNS TABLE ("tenantId" text) AS $$
  SELECT DISTINCT o."tenantId" FROM "Order" o
  WHERE o.status = 'SHIPPED' AND o."consignmentId" IS NOT NULL AND o."courierProvider" IN ('STEADFAST', 'PATHAO', 'REDX');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_open_parcels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_open_parcels() TO biztrack_app, biztrack_platform;
