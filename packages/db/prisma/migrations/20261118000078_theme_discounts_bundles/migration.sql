-- Theme discount codes and bundles. Additive only: two new tables, new nullable or defaulted columns on ThemePurchase, one function.
CREATE TABLE "ThemeDiscount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "themeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThemeDiscount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ThemeDiscount_code_key" ON "ThemeDiscount"("code");

CREATE TABLE "ThemeBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL DEFAULT '',
    "themeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceModel" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "priceBdt" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThemeBundle_pkey" PRIMARY KEY ("id")
);

-- One payment, several themes: the rows of a payment share groupId/bundleId; discountAmount is the row's share of the taka taken off.
ALTER TABLE "ThemePurchase" ADD COLUMN "bundleId" TEXT;
ALTER TABLE "ThemePurchase" ADD COLUMN "groupId" TEXT;
ALTER TABLE "ThemePurchase" ADD COLUMN "leadRow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ThemePurchase" ADD COLUMN "discountCode" TEXT;
ALTER TABLE "ThemePurchase" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE INDEX "ThemePurchase_groupId_idx" ON "ThemePurchase"("groupId");
CREATE INDEX "ThemePurchase_discountCode_idx" ON "ThemePurchase"("discountCode");

-- Platform tables. Stores read ACTIVE rows only (to price a checkout); only the platform role writes.
ALTER TABLE "ThemeDiscount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS themediscount_read_active_by_store_apps ON "ThemeDiscount";
CREATE POLICY themediscount_read_active_by_store_apps ON "ThemeDiscount" FOR SELECT TO biztrack_app USING ("active");
REVOKE ALL ON "ThemeDiscount" FROM biztrack_app;
GRANT SELECT ON "ThemeDiscount" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ThemeDiscount" TO biztrack_platform;

ALTER TABLE "ThemeBundle" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS themebundle_read_active_by_store_apps ON "ThemeBundle";
CREATE POLICY themebundle_read_active_by_store_apps ON "ThemeBundle" FOR SELECT TO biztrack_app USING ("active");
REVOKE ALL ON "ThemeBundle" FROM biztrack_app;
GRANT SELECT ON "ThemeBundle" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ThemeBundle" TO biztrack_platform;

-- A store cannot update a code, so using one goes through this function: it counts the use and checks the limits in one statement, so two
-- stores racing for the last use cannot both win. It runs inside the store's own transaction, so a purchase that fails gives the use back.
CREATE OR REPLACE FUNCTION theme_discount_redeem(p_code TEXT) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH hit AS (
    UPDATE "ThemeDiscount" SET "usedCount" = "usedCount" + 1
    WHERE "code" = p_code AND "active" AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM hit)
$$;
REVOKE ALL ON FUNCTION theme_discount_redeem(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION theme_discount_redeem(TEXT) TO biztrack_app, biztrack_platform;
