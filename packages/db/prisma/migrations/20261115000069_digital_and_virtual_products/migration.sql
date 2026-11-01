-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isDigital" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalDelivery" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalFileUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalFileName" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalFileSize" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalCustomFields" JSONB;
CREATE INDEX IF NOT EXISTS "Product_tenantId_isDigital_idx" ON "Product"("tenantId", "isDigital");

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isDigital" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Order_tenantId_isDigital_idx" ON "Order"("tenantId", "isDigital");

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isDigital" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "digitalCustomValues" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "digitalDeliveryUrl" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "digitalDeliveredAt" TIMESTAMP(3);
