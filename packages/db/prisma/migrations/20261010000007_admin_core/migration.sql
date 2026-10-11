-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "bkashEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bkashInstruction" TEXT,
ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codFee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "codMaxAmount" DECIMAL(12,2),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "invoiceOptions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "nagadEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nagadInstruction" TEXT,
ADD COLUMN     "ordersPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "storeNameBn" TEXT;

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_tenantId_orderId_createdAt_idx" ON "OrderEvent"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_tenantId_variantId_createdAt_idx" ON "StockAdjustment"("tenantId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_tenantId_createdAt_idx" ON "StockAdjustment"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security for the new tenant tables (same policy as every other tenant table).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['OrderEvent', 'StockAdjustment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "OrderEvent", "StockAdjustment" TO biztrack_app, biztrack_platform;

-- Timeline and stock history are append-only for the application role, like the audit log.
REVOKE UPDATE, DELETE ON "OrderEvent", "StockAdjustment" FROM biztrack_app;

-- A timeline entry may only point at an order of the same store.
DROP TRIGGER IF EXISTS trg_tenant_fk_OrderEvent_orderId ON "OrderEvent";
CREATE TRIGGER trg_tenant_fk_OrderEvent_orderId BEFORE INSERT OR UPDATE ON "OrderEvent" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('Order', 'orderId');
