-- Landing page views, orders and leads (docs/46, stage 3).
ALTER TABLE "Order" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Order" ADD COLUMN "landingPageId" TEXT;
CREATE INDEX "Order_tenantId_landingPageId_idx" ON "Order"("tenantId", "landingPageId");

CREATE TABLE "LandingDaily" (
    "landingPageId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "tenantId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LandingDaily_pkey" PRIMARY KEY ("landingPageId", "day")
);
CREATE INDEX "LandingDaily_tenantId_day_idx" ON "LandingDaily"("tenantId", "day");
ALTER TABLE "LandingDaily" ADD CONSTRAINT "LandingDaily_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingDaily" ADD CONSTRAINT "LandingDaily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LandingLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "offerLabel" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LandingLead_landingPageId_phone_key" ON "LandingLead"("landingPageId", "phone");
CREATE INDEX "LandingLead_tenantId_createdAt_idx" ON "LandingLead"("tenantId", "createdAt");
ALTER TABLE "LandingLead" ADD CONSTRAINT "LandingLead_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingLead" ADD CONSTRAINT "LandingLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security like every table with a tenantId: a store sees only its own rows.
ALTER TABLE "LandingDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LandingDaily" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "LandingDaily";
CREATE POLICY tenant_isolation_policy ON "LandingDaily" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "LandingDaily" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LandingDaily" TO biztrack_platform;

ALTER TABLE "LandingLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LandingLead" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "LandingLead";
CREATE POLICY tenant_isolation_policy ON "LandingLead" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "LandingLead" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LandingLead" TO biztrack_platform;
