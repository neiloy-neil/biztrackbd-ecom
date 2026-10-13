-- Pages built from sections in the visual editor (docs/47, part D).
ALTER TABLE "Page" ADD COLUMN "sectionsJson" JSONB;
ALTER TABLE "Page" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "Page" ADD COLUMN "seoDescription" TEXT;
