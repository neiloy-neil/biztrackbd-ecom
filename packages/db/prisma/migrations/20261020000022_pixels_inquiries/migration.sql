-- Per-store tracking ids (Google Analytics, Tag Manager, TikTok Pixel). Without these columns every read of StoreSettings fails.
ALTER TABLE "StoreSettings" ADD COLUMN "googleAnalyticsId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "googleTagManagerId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "tiktokPixelId" TEXT;

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "PlatformInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformInquiry_status_createdAt_idx" ON "PlatformInquiry"("status", "createdAt");
CREATE INDEX "PlatformInquiry_phone_idx" ON "PlatformInquiry"("phone");
CREATE INDEX "PlatformInquiry_topic_idx" ON "PlatformInquiry"("topic");

-- Platform-only table, hidden from the store tenant app role
REVOKE ALL ON "PlatformInquiry" FROM biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformInquiry" TO biztrack_platform;
