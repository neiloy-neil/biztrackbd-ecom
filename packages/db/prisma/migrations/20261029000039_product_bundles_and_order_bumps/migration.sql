-- CreateEnum
CREATE TYPE "BundleDiscountType" AS ENUM ('FIXED_PRICE', 'PERCENTAGE', 'FIXED_DISCOUNT');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BumpTriggerType" AS ENUM ('GLOBAL', 'PRODUCT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "BumpStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "bundleId" TEXT,
ADD COLUMN "bundleTitle" TEXT,
ADD COLUMN "isBump" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable ProductBundle
CREATE TABLE "ProductBundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleBn" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "descriptionBn" TEXT,
    "bannerImage" TEXT,
    "discountType" "BundleDiscountType" NOT NULL DEFAULT 'FIXED_PRICE',
    "discountValue" DECIMAL(12,2) NOT NULL,
    "allowCoupon" BOOLEAN NOT NULL DEFAULT false,
    "status" "BundleStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProductBundleItem
CREATE TABLE "ProductBundleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrderBump
CREATE TABLE "OrderBump" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleBn" TEXT,
    "highlightText" TEXT,
    "highlightTextBn" TEXT,
    "description" TEXT,
    "descriptionBn" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "bumpPrice" DECIMAL(12,2) NOT NULL,
    "allowCoupon" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" "BumpTriggerType" NOT NULL DEFAULT 'GLOBAL',
    "triggerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BumpStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBump_pkey" PRIMARY KEY ("id")
);

-- Indexes on ProductBundle
CREATE UNIQUE INDEX "ProductBundle_tenantId_slug_key" ON "ProductBundle"("tenantId", "slug");
CREATE INDEX "ProductBundle_tenantId_status_idx" ON "ProductBundle"("tenantId", "status");

-- Indexes on ProductBundleItem
CREATE INDEX "ProductBundleItem_tenantId_bundleId_idx" ON "ProductBundleItem"("tenantId", "bundleId");
CREATE INDEX "ProductBundleItem_productId_idx" ON "ProductBundleItem"("productId");
CREATE INDEX "ProductBundleItem_variantId_idx" ON "ProductBundleItem"("variantId");

-- Indexes on OrderBump
CREATE INDEX "OrderBump_tenantId_status_idx" ON "OrderBump"("tenantId", "status");
CREATE INDEX "OrderBump_tenantId_triggerType_idx" ON "OrderBump"("tenantId", "triggerType");

-- Index on OrderItem bundleId
CREATE INDEX "OrderItem_bundleId_idx" ON "OrderItem"("bundleId");

-- Foreign Keys
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductBundle" ADD CONSTRAINT "ProductBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderBump" ADD CONSTRAINT "OrderBump_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBump" ADD CONSTRAINT "OrderBump_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBump" ADD CONSTRAINT "OrderBump_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (RLS)
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ProductBundle', 'ProductBundleItem', 'OrderBump'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ProductBundle", "ProductBundleItem", "OrderBump" TO biztrack_app;
