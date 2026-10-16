-- AlterTable StoreSettings
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "aiChatbotInstructions" TEXT;
