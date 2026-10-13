-- The store contact inbox and back-in-stock requests.
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "replyText" TEXT,
    "repliedBy" TEXT,
    "repliedAt" TIMESTAMP(3),
    "clientHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "skipReason" TEXT,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_tenantId_status_createdAt_idx" ON "ContactMessage"("tenantId", "status", "createdAt");
CREATE INDEX "ContactMessage_tenantId_phone_createdAt_idx" ON "ContactMessage"("tenantId", "phone", "createdAt");
CREATE UNIQUE INDEX "StockAlert_variantId_phone_key" ON "StockAlert"("variantId", "phone");
CREATE INDEX "StockAlert_tenantId_notifiedAt_idx" ON "StockAlert"("tenantId", "notifiedAt");

ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, like every table with a tenantId.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ContactMessage', 'StockAlert'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
  END LOOP;
END $$;

-- A request can only name a variant of its own store.
CREATE TRIGGER trg_tenant_fk_StockAlert_variantId BEFORE INSERT OR UPDATE ON "StockAlert" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('ProductVariant', 'variantId');

GRANT SELECT, INSERT, UPDATE, DELETE ON "ContactMessage", "StockAlert" TO biztrack_app;

-- For the scheduled job: the stores that have shoppers waiting for something that is back in stock. Names no customer data.
CREATE OR REPLACE FUNCTION tenants_with_restocked_alerts()
RETURNS TABLE ("tenantId" text) AS $$
  SELECT DISTINCT a."tenantId" FROM "StockAlert" a JOIN "ProductVariant" v ON v.id = a."variantId"
  WHERE a."notifiedAt" IS NULL AND v."stockQuantity" > 0;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_restocked_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_restocked_alerts() TO biztrack_app, biztrack_platform;
