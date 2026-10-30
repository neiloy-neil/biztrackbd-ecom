-- AlterTable: SEO title and description overrides, a cover image, and a noindex switch for guides written in Platform Admin.
ALTER TABLE "PlatformBlogPost"
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "coverAlt" TEXT,
  ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;
