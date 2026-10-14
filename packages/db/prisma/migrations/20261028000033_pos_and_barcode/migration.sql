-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "posRegisterId" TEXT,
ADD COLUMN "posSessionId" TEXT,
ADD COLUMN "paymentSplits" JSONB;

-- CreateTable
CREATE TABLE "PosRegister" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "receiptPrinterWidth" INTEGER NOT NULL DEFAULT 80,
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DECIMAL(12,2) NOT NULL,
    "closingCounted" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2),
    "cashDifference" DECIMAL(12,2),
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosCashMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosCashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosRegister_tenantId_code_key" ON "PosRegister"("tenantId", "code");
CREATE INDEX "PosRegister_tenantId_idx" ON "PosRegister"("tenantId");

-- CreateIndex
CREATE INDEX "PosSession_tenantId_registerId_status_idx" ON "PosSession"("tenantId", "registerId", "status");
CREATE INDEX "PosSession_tenantId_openedAt_idx" ON "PosSession"("tenantId", "openedAt");

-- CreateIndex
CREATE INDEX "PosCashMovement_tenantId_sessionId_idx" ON "PosCashMovement"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "ProductVariant_tenantId_barcode_idx" ON "ProductVariant"("tenantId", "barcode");

-- AddForeignKey
ALTER TABLE "PosRegister" ADD CONSTRAINT "PosRegister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "PosRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PosSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS Policies
ALTER TABLE "PosRegister" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosCashMovement" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'PosRegister' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON "PosRegister"
      AS RESTRICTIVE
      USING ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'PosSession' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON "PosSession"
      AS RESTRICTIVE
      USING ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'PosCashMovement' AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy ON "PosCashMovement"
      AS RESTRICTIVE
      USING ("tenantId" = current_setting('app.current_tenant_id', true));
  END IF;
END $$;
