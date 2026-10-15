-- AlterTable WhatsAppConversation
ALTER TABLE "WhatsAppConversation" ADD COLUMN "botPausedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WhatsAppConversation_tenantId_assignedUserId_idx" ON "WhatsAppConversation"("tenantId", "assignedUserId");

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "TenantUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable SupportQuickReply
CREATE TABLE "SupportQuickReply" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportQuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportQuickReply_tenantId_shortcut_key" ON "SupportQuickReply"("tenantId", "shortcut");
CREATE INDEX "SupportQuickReply_tenantId_category_idx" ON "SupportQuickReply"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "SupportQuickReply" ADD CONSTRAINT "SupportQuickReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "SupportQuickReply" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "SupportQuickReply" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

GRANT ALL ON "SupportQuickReply" TO biztrack_app;
