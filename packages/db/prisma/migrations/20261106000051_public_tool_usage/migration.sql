-- CreateTable PublicToolUsage (RISK-003)
CREATE TABLE IF NOT EXISTS "PublicToolUsage" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicToolUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PublicToolUsage_tool_bucket_key" ON "PublicToolUsage"("tool", "bucket");
CREATE INDEX IF NOT EXISTS "PublicToolUsage_tool_bucket_idx" ON "PublicToolUsage"("tool", "bucket");

-- Row Level Security (RLS) Policy
-- PublicToolUsage is a platform utility table for distributed rate limiting (no tenantId).
-- Allow biztrack_app and biztrack_platform full access to maintain quota records.
ALTER TABLE "PublicToolUsage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_tool_usage_policy ON "PublicToolUsage";
CREATE POLICY public_tool_usage_policy ON "PublicToolUsage" FOR ALL TO biztrack_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON "PublicToolUsage" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PublicToolUsage" TO biztrack_platform;
