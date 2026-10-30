-- CreateEnum
CREATE TYPE "PlatformBlogStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "PlatformBlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "status" "PlatformBlogStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformBlogPost_slug_key" ON "PlatformBlogPost"("slug");
CREATE INDEX "PlatformBlogPost_status_publishedAt_idx" ON "PlatformBlogPost"("status", "publishedAt");

-- The marketing site connects with the store-app role (biztrack_app). It may read only posts that are published and due, so drafts
-- stay invisible even to a direct query. Writes stay with biztrack_platform, which bypasses row-level security.
ALTER TABLE "PlatformBlogPost" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON "PlatformBlogPost" TO biztrack_app;
DROP POLICY IF EXISTS platform_blog_post_public_read ON "PlatformBlogPost";
CREATE POLICY platform_blog_post_public_read ON "PlatformBlogPost" FOR SELECT TO biztrack_app
  USING (status = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "publishedAt" <= now());
