-- CreateEnum
CREATE TYPE "WhatsAppProviderMode" AS ENUM ('QR_SESSION', 'GATEWAY_API', 'MANUAL_LINKS');

-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('DISCONNECTED', 'SCAN_QR', 'CONNECTED', 'PAIRING', 'ERROR');

-- CreateEnum
CREATE TYPE "WhatsAppEventType" AS ENUM ('COD_CONFIRMATION', 'ORDER_CONFIRMED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'ABANDONED_CART_STAGE_1', 'ABANDONED_CART_STAGE_2');

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'FALLBACK_TO_SMS');

-- CreateEnum
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('BOT_HANDLED', 'OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerMode" "WhatsAppProviderMode" NOT NULL DEFAULT 'QR_SESSION',
    "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "phoneNumber" TEXT,
    "sessionData" TEXT,
    "qrCodeData" TEXT,
    "gatewayUrl" TEXT,
    "gatewayApiKey" TEXT,
    "webhookSecret" TEXT,
    "autoConfirmCod" BOOLEAN NOT NULL DEFAULT true,
    "shippingUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "abandonedRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "botEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "followUpReminderHours" INTEGER NOT NULL DEFAULT 12,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" "WhatsAppEventType" NOT NULL,
    "name" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyBn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "event" "WhatsAppEventType",
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "messageBody" TEXT NOT NULL,
    "externalMsgId" TEXT,
    "errorDetails" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'BOT_HANDLED',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageText" TEXT,
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "staffUserId" TEXT,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "externalMsgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfig_tenantId_key" ON "WhatsAppConfig"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppConfig_tenantId_idx" ON "WhatsAppConfig"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_tenantId_idx" ON "WhatsAppTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_tenantId_event_key" ON "WhatsAppTemplate"("tenantId", "event");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_tenantId_phone_idx" ON "WhatsAppMessageLog"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_tenantId_orderId_idx" ON "WhatsAppMessageLog"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_tenantId_event_status_idx" ON "WhatsAppMessageLog"("tenantId", "event", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_tenantId_status_lastMessageAt_idx" ON "WhatsAppConversation"("tenantId", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_tenantId_customerPhone_key" ON "WhatsAppConversation"("tenantId", "customerPhone");

-- CreateIndex
CREATE INDEX "WhatsAppChatMessage_conversationId_createdAt_idx" ON "WhatsAppChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppChatMessage_tenantId_idx" ON "WhatsAppChatMessage"("tenantId");

-- AddForeignKey
ALTER TABLE "WhatsAppConfig" ADD CONSTRAINT "WhatsAppConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessageLog" ADD CONSTRAINT "WhatsAppMessageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessageLog" ADD CONSTRAINT "WhatsAppMessageLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMessage" ADD CONSTRAINT "WhatsAppChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMessage" ADD CONSTRAINT "WhatsAppChatMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "WhatsAppConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppMessageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppChatMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "WhatsAppConfig" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WhatsAppTemplate" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WhatsAppMessageLog" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WhatsAppConversation" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
CREATE POLICY tenant_isolation_policy ON "WhatsAppChatMessage" FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());

GRANT ALL ON "WhatsAppConfig", "WhatsAppTemplate", "WhatsAppMessageLog", "WhatsAppConversation", "WhatsAppChatMessage" TO biztrack_app;
