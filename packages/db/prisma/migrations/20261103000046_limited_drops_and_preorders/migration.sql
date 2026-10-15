-- CreateEnum
CREATE TYPE "DropMode" AS ENUM ('TEASER_WAITLIST', 'LIVE_PREORDER');

-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DropDepositType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE', 'FULL');

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isPreOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "preOrderDropId" TEXT;

-- CreateTable LimitedDrop
CREATE TABLE "LimitedDrop" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerImage" TEXT,
    "mode" "DropMode" NOT NULL DEFAULT 'LIVE_PREORDER',
    "status" "DropStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "estimatedShipDate" TIMESTAMP(3),
    "depositType" "DropDepositType" NOT NULL DEFAULT 'NONE',
    "depositValue" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "allocationCap" INTEGER,
    "claimedUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LimitedDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable DropProduct
CREATE TABLE "DropProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "allocatedQty" INTEGER,

    CONSTRAINT "DropProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable DropWaitlistSubscriber
CREATE TABLE "DropWaitlistSubscriber" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropWaitlistSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LimitedDrop_tenantId_slug_key" ON "LimitedDrop"("tenantId", "slug");
CREATE INDEX "LimitedDrop_tenantId_status_startsAt_idx" ON "LimitedDrop"("tenantId", "status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DropProduct_dropId_productId_variantId_key" ON "DropProduct"("dropId", "productId", "variantId");
CREATE INDEX "DropProduct_tenantId_dropId_idx" ON "DropProduct"("tenantId", "dropId");

-- CreateIndex
CREATE UNIQUE INDEX "DropWaitlistSubscriber_dropId_phone_key" ON "DropWaitlistSubscriber"("dropId", "phone");
CREATE INDEX "DropWaitlistSubscriber_tenantId_dropId_notifiedAt_idx" ON "DropWaitlistSubscriber"("tenantId", "dropId", "notifiedAt");

-- AddForeignKey
ALTER TABLE "LimitedDrop" ADD CONSTRAINT "LimitedDrop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropProduct" ADD CONSTRAINT "DropProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DropProduct" ADD CONSTRAINT "DropProduct_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "LimitedDrop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DropProduct" ADD CONSTRAINT "DropProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropWaitlistSubscriber" ADD CONSTRAINT "DropWaitlistSubscriber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DropWaitlistSubscriber" ADD CONSTRAINT "DropWaitlistSubscriber_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "LimitedDrop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS Enforcement
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'LimitedDrop',
    'DropProduct',
    'DropWaitlistSubscriber'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO biztrack_app', tbl);
  END LOOP;
END $$;
