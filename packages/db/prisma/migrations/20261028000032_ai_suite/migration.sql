-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "customGeminiApiKey" TEXT,
ADD COLUMN "aiChatbotEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "aiChatbotName" TEXT NOT NULL DEFAULT 'শপ অ্যাসিস্ট্যান্ট',
ADD COLUMN "aiChatbotWelcome" TEXT,
ADD COLUMN "aiChatbotEscalatePhone" TEXT;
