-- AlterTable Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "siteMode" TEXT NOT NULL DEFAULT 'ECOMMERCE';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "businessVertical" TEXT;

-- CreateEnum SiteLeadType
DO $$ BEGIN
  CREATE TYPE "SiteLeadType" AS ENUM ('CONTACT', 'QUOTE', 'APPOINTMENT', 'RESERVATION', 'MEDIA_BOOKING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum SiteLeadStatus
DO $$ BEGIN
  CREATE TYPE "SiteLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'CLOSED', 'SPAM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum BookingRequestStatus
DO $$ BEGIN
  CREATE TYPE "BookingRequestStatus" AS ENUM ('REQUESTED', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum SiteContentKind
DO $$ BEGIN
  CREATE TYPE "SiteContentKind" AS ENUM ('SERVICE', 'PORTFOLIO', 'TEAM', 'CREDENTIAL', 'PUBLICATION', 'EVENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable SiteLead
CREATE TABLE IF NOT EXISTS "SiteLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SiteLeadType" NOT NULL DEFAULT 'CONTACT',
    "status" "SiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "sourcePage" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrer" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "consentGivenAt" TIMESTAMP(3),
    "privateNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable BookingRequest
CREATE TABLE IF NOT EXISTS "BookingRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "serviceName" TEXT,
    "providerName" TEXT,
    "requestedDate" TIMESTAMP(3),
    "requestedTime" TEXT,
    "partySize" INTEGER,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "privateNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable MenuCategory
CREATE TABLE IF NOT EXISTS "MenuCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "description" TEXT,
    "descriptionBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable MenuItem
CREATE TABLE IF NOT EXISTS "MenuItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "description" TEXT,
    "descriptionBn" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "imageUrl" TEXT,
    "dietaryLabels" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable SiteContentItem
CREATE TABLE IF NOT EXISTS "SiteContentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "SiteContentKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleBn" TEXT,
    "summary" TEXT,
    "summaryBn" TEXT,
    "bodyHtml" TEXT,
    "bodyHtmlBn" TEXT,
    "mediaUrl" TEXT,
    "data" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable SiteDownload
CREATE TABLE IF NOT EXISTS "SiteDownload" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelBn" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'FILE',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDownload_pkey" PRIMARY KEY ("id")
);

-- Indexes and Constraints
CREATE INDEX IF NOT EXISTS "SiteLead_tenantId_status_idx" ON "SiteLead"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "SiteLead_tenantId_type_idx" ON "SiteLead"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "SiteLead_tenantId_createdAt_idx" ON "SiteLead"("tenantId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequest_leadId_key" ON "BookingRequest"("leadId");
CREATE INDEX IF NOT EXISTS "BookingRequest_tenantId_status_idx" ON "BookingRequest"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "BookingRequest_tenantId_requestedDate_idx" ON "BookingRequest"("tenantId", "requestedDate");

CREATE INDEX IF NOT EXISTS "MenuCategory_tenantId_sortOrder_idx" ON "MenuCategory"("tenantId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuCategory_tenantId_isActive_idx" ON "MenuCategory"("tenantId", "isActive");

CREATE INDEX IF NOT EXISTS "MenuItem_tenantId_categoryId_sortOrder_idx" ON "MenuItem"("tenantId", "categoryId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuItem_tenantId_isAvailable_idx" ON "MenuItem"("tenantId", "isAvailable");

CREATE UNIQUE INDEX IF NOT EXISTS "SiteContentItem_tenantId_kind_slug_key" ON "SiteContentItem"("tenantId", "kind", "slug");
CREATE INDEX IF NOT EXISTS "SiteContentItem_tenantId_kind_isPublished_sortOrder_idx" ON "SiteContentItem"("tenantId", "kind", "isPublished", "sortOrder");

CREATE INDEX IF NOT EXISTS "SiteDownload_tenantId_isPublic_sortOrder_idx" ON "SiteDownload"("tenantId", "isPublic", "sortOrder");

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "SiteLead" ADD CONSTRAINT "SiteLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SiteLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SiteContentItem" ADD CONSTRAINT "SiteContentItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SiteDownload" ADD CONSTRAINT "SiteDownload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Row Level Security (RLS) Policies
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'SiteLead',
    'BookingRequest',
    'MenuCategory',
    'MenuItem',
    'SiteContentItem',
    'SiteDownload'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO biztrack_app', tbl);
  END LOOP;
END $$;
