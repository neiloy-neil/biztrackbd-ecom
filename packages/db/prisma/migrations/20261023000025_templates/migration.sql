-- Templates published by platform staff without a deploy (docs/46, stage 5).
ALTER TABLE "Tenant" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "templateVersion" INTEGER;

CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "baseLook" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "settingsJson" JSONB NOT NULL,
    "pagesJson" JSONB NOT NULL,
    "sourceTenantId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- A platform table: stores (and the signup and the public gallery) read published and archived templates (an archived one hides an original
-- template of the same id); drafts stay private. Only the platform role writes.
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS template_read_by_store_apps ON "Template";
CREATE POLICY template_read_by_store_apps ON "Template" FOR SELECT TO biztrack_app USING ("status" <> 'DRAFT');
GRANT SELECT ON "Template" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Template" TO biztrack_platform;
