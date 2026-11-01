-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "TenantLeadStage" AS ENUM ('NEW', 'CONTACTED', 'DEMO_IN_PROGRESS', 'HOT_LEAD', 'CONVERTED', 'LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenantCrmActivityType" AS ENUM ('WHATSAPP', 'PHONE_CALL', 'STAGE_CHANGE', 'NOTE', 'FOLLOW_UP_SCHEDULED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Alter Tenant Table
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "leadStage" "TenantLeadStage" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "leadAssignedToId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "leadLastContactedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "leadNextFollowUpAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "leadNotesSummary" TEXT;

-- 3. Create TenantCrmActivity Table
CREATE TABLE IF NOT EXISTS "TenantCrmActivity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT,
  "type" "TenantCrmActivityType" NOT NULL,
  "outcome" TEXT,
  "templateKey" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantCrmActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantCrmActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantCrmActivity_tenantId_createdAt_idx" ON "TenantCrmActivity"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "TenantCrmActivity_actorId_createdAt_idx" ON "TenantCrmActivity"("actorId", "createdAt");

-- 4. Create PlatformCrmTemplate Table
CREATE TABLE IF NOT EXISTS "PlatformCrmTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'bn',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformCrmTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformCrmTemplate_key_key" ON "PlatformCrmTemplate"("key");

-- 5. Security & RLS
REVOKE ALL ON "TenantCrmActivity" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON "TenantCrmActivity" FROM biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantCrmActivity" TO biztrack_platform;

ALTER TABLE "TenantCrmActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantCrmActivity" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "TenantCrmActivity";
CREATE POLICY tenant_isolation_policy ON "TenantCrmActivity"
  FOR ALL TO biztrack_app
  USING ("tenantId" = current_tenant())
  WITH CHECK ("tenantId" = current_tenant());

REVOKE ALL ON "PlatformCrmTemplate" FROM PUBLIC, anon, authenticated, biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformCrmTemplate" TO biztrack_platform;

ALTER TABLE "PlatformCrmTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformCrmTemplate" FORCE ROW LEVEL SECURITY;

-- 6. Seed Default WhatsApp Templates
INSERT INTO "PlatformCrmTemplate" ("id", "key", "title", "body", "language", "isDefault", "updatedAt")
VALUES
  (
    'crm_tmpl_welcome_bn',
    'welcome_bn',
    'Welcome & Greeting (বাংলা)',
    'আসসালামু আলাইকুম {ownerName} ভাই! BizTrack BD-তে স্বাগতম। আপনার নতুন স্টোর "{storeName}" ({subdomain}.biztrack.bd) তৈরি হয়েছে দেখেছি। আপনার স্টোর লাইভ করতে বা প্রোডাক্ট আপলোডে কোনো সহায়তা লাগলে আমাকে সরাসরি জানাতে পারেন। শুভকামনা!',
    'bn',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'crm_tmpl_setup_help_bn',
    'setup_help_bn',
    'Free Setup Assistance (বাংলা)',
    'হ্যালো {ownerName}, BizTrack BD মার্চেন্ট সাপোর্ট থেকে বলছি। আপনার স্টোরের থিম ডিজাইন ও bKash/Nagad পেমেন্ট সেটআপের জন্য আমরা কি একটি ছোট ফ্রি ডেমো কলে আপনাকে গাইড করতে পারি? আপনি কখন ফ্রি আছেন জানাবেন।',
    'bn',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'crm_tmpl_domain_help_bn',
    'domain_help_bn',
    'Custom Domain Setup (বাংলা)',
    'আসসালামু আলাইকুম {ownerName}, আপনার স্টোরে কি নিজস্ব ব্র্যান্ড ডোমেন (.com বা .com.bd) যুক্ত করতে চান? আমাদের টিম সম্পূর্ণ ফ্রিতে আপনার ডোমেন ও SSL কনফিগারেশন করে দিচ্ছে। সাহায্য লাগলে জানাবেন।',
    'bn',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'crm_tmpl_trial_checkin_bn',
    'trial_checkin_bn',
    'Trial Ending Reminder (বাংলা)',
    'প্রিয় {ownerName}, আপনার BizTrack BD স্টোরের ফ্রি ট্রায়ালের মেয়াদ শেষ হতে আর মাত্র কয়েক দিন বাকি। আপনার শপটি চালু রাখতে এবং আকর্ষণীয় অফার পেতে এখনই যোগাযোগ করুন।',
    'bn',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'crm_tmpl_welcome_en',
    'welcome_en',
    'Welcome & Onboarding (English)',
    'Hello {ownerName}! Welcome to BizTrack BD. We noticed you just created "{storeName}" ({storeUrl}). Let us know if you need any assistance adding products, configuring payments, or setting up your custom domain!',
    'en',
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
