-- The Business-website plans become data the platform admin can edit, like Plan. Until now they were constants in code.
CREATE TABLE "SitePlan" (
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthlyBdt" DECIMAL(12,2) NOT NULL,
    "priceYearlyBdt" DECIMAL(12,2) NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SitePlan_pkey" PRIMARY KEY ("tier")
);

-- Platform table: store apps may read it (price list, limits), only the platform writes.
REVOKE ALL ON "SitePlan" FROM biztrack_app;
GRANT SELECT ON "SitePlan" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "SitePlan" TO biztrack_platform;
CREATE POLICY siteplan_read_by_store_apps ON "SitePlan" FOR SELECT TO biztrack_app USING (true);

INSERT INTO "SitePlan" ("tier", "name", "priceMonthlyBdt", "priceYearlyBdt", "trialDays", "isPublic", "sortOrder", "limits", "features", "updatedAt") VALUES
('STARTER', 'Business Starter', 399, 3990, 14, true, 1,
 '{"products":10,"ordersPerMonth":0,"staff":1,"storageGb":5,"landingPages":5,"customPages":5,"downloads":5,"contentItems":15}',
 '{"customDomain":true,"sectionBuilder":"home","headerFooterEditing":false,"leadCapture":true,"whatsappAlerts":true,"bookingRequests":false,"teamProfiles":false,"hybridStore":false,"courierBooking":"manual","modules":0,"capi":true}', now()),
('PRO', 'Business Pro', 799, 7990, 14, true, 2,
 '{"products":50,"ordersPerMonth":500,"staff":3,"storageGb":20,"landingPages":20,"customPages":20,"downloads":null,"contentItems":null}',
 '{"customDomain":true,"sectionBuilder":"all","headerFooterEditing":true,"leadCapture":true,"whatsappAlerts":true,"bookingRequests":true,"teamProfiles":true,"hybridStore":true,"courierBooking":"auto","modules":3,"capi":true}', now()),
('BUSINESS', 'Business Plus', 1499, 14990, 14, true, 3,
 '{"products":200,"ordersPerMonth":1000,"staff":10,"storageGb":100,"landingPages":50,"customPages":null,"downloads":null,"contentItems":null}',
 '{"customDomain":true,"sectionBuilder":"all","headerFooterEditing":true,"leadCapture":true,"whatsappAlerts":true,"bookingRequests":true,"teamProfiles":true,"hybridStore":true,"courierBooking":"auto","modules":"all","capi":true}', now());
