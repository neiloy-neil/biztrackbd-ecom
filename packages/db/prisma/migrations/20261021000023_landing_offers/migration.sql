-- Landing pages sell more than one product and have a short address (docs/46, stage 1).
ALTER TABLE "LandingPage" ADD COLUMN "offersJson" JSONB;
ALTER TABLE "LandingPage" ADD COLUMN "shortCode" TEXT;
UPDATE "LandingPage" SET "shortCode" = substr(md5(random()::text || "id"), 1, 7) WHERE "shortCode" IS NULL;
CREATE UNIQUE INDEX "LandingPage_shortCode_key" ON "LandingPage"("shortCode");
