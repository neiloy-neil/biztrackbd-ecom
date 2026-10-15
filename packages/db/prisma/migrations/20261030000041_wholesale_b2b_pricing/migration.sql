-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
ALTER TYPE "PaymentMethodType" ADD VALUE 'BANK_TRANSFER';

-- CreateEnum
CREATE TYPE "WholesaleApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "moq" INTEGER DEFAULT 1;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "isWholesale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "advancePaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "b2bCompanyName" TEXT,
ADD COLUMN "b2bTaxId" TEXT,
ADD COLUMN "b2bTradeLicense" TEXT;

-- AlterTable StoreSettings
ALTER TABLE "StoreSettings" ADD COLUMN "wholesaleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "wholesaleMinOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
ADD COLUMN "wholesaleDefaultMoq" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN "wholesaleAllowRegistration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "wholesaleBankDetails" JSONB;

-- CreateTable WholesaleTier
CREATE TABLE "WholesaleTier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "minOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
    "allowCod" BOOLEAN NOT NULL DEFAULT false,
    "partialDepositPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable WholesaleCustomer
CREATE TABLE "WholesaleCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tierId" TEXT,
    "companyName" TEXT NOT NULL,
    "tradeLicense" TEXT,
    "businessType" TEXT,
    "taxId" TEXT,
    "whatsappNumber" TEXT,
    "address" TEXT,
    "district" TEXT,
    "status" "WholesaleApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable WholesalePrice
CREATE TABLE "WholesalePrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "tierId" TEXT,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WholesaleTier_tenantId_idx" ON "WholesaleTier"("tenantId");
CREATE UNIQUE INDEX "WholesaleTier_tenantId_name_key" ON "WholesaleTier"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleCustomer_customerId_key" ON "WholesaleCustomer"("customerId");
CREATE INDEX "WholesaleCustomer_tenantId_status_idx" ON "WholesaleCustomer"("tenantId", "status");
CREATE INDEX "WholesaleCustomer_tenantId_tierId_idx" ON "WholesaleCustomer"("tenantId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalePrice_variantId_tierId_minQuantity_key" ON "WholesalePrice"("variantId", "tierId", "minQuantity");
CREATE INDEX "WholesalePrice_tenantId_variantId_idx" ON "WholesalePrice"("tenantId", "variantId");

-- AddForeignKey
ALTER TABLE "WholesaleTier" ADD CONSTRAINT "WholesaleTier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCustomer" ADD CONSTRAINT "WholesaleCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleCustomer" ADD CONSTRAINT "WholesaleCustomer_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "WholesaleTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WholesaleCustomer" ADD CONSTRAINT "WholesaleCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePrice" ADD CONSTRAINT "WholesalePrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesalePrice" ADD CONSTRAINT "WholesalePrice_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "WholesaleTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesalePrice" ADD CONSTRAINT "WholesalePrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "WholesaleTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WholesaleCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WholesalePrice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "WholesaleTier" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WholesaleCustomer" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WholesalePrice" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

GRANT ALL ON "WholesaleTier", "WholesaleCustomer", "WholesalePrice" TO biztrack_app;
