-- AlterTable StoreSettings to support Google Cloud Console Suite (Search Console, OAuth 2.0, Merchant Center)
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "googleSiteVerification" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "googleOAuthClientId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "googleOAuthClientSecret" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "googleMerchantCenterId" TEXT;
