-- The theme catalogue becomes data the platform admin edits: free or premium, price, one-time or monthly, and the plans that include a theme.
-- The built-in themes are written into it from the code (syncBuiltinThemes); until a row exists the code's own definition applies.
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'BUILTIN',
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "priceModel" TEXT NOT NULL DEFAULT 'FREE',
    "priceBdt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "includedPlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Theme_status_sortOrder_idx" ON "Theme"("status", "sortOrder");

-- A monthly theme purchase lasts until this date; null means owned for life.
ALTER TABLE "ThemePurchase" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Platform table: store apps read every row (the catalogue code hides archived and draft themes; a row the app could not see would make an
-- archived built-in theme fall back to the code's definition and reappear), only the platform role writes.
ALTER TABLE "Theme" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS theme_read_by_store_apps ON "Theme";
CREATE POLICY theme_read_by_store_apps ON "Theme" FOR SELECT TO biztrack_app USING (true);
REVOKE ALL ON "Theme" FROM biztrack_app;
GRANT SELECT ON "Theme" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Theme" TO biztrack_platform;
