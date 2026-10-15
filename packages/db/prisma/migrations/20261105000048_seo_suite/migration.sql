-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "socialShareImageUrl" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "richSnippetsEnabled" BOOLEAN NOT NULL DEFAULT true;
