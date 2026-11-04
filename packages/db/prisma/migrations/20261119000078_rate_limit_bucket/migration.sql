-- Shared rate limit counters (security audit F6). Replaces per-instance in-memory Maps in the public routes.
-- "key" is a salted hash of scope + subject (an IP, a user id); a raw IP is never stored. One row per key per fixed time window.
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key","windowStart")
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- Platform utility table with no tenantId, like PublicToolUsage: the public routes (marketing, storefront, admin) write it as the app role,
-- the platform role can do the same. The key is a one-way hash, so an open policy exposes nothing readable.
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_limit_bucket_policy ON "RateLimitBucket";
CREATE POLICY rate_limit_bucket_policy ON "RateLimitBucket" FOR ALL TO biztrack_app USING (true) WITH CHECK (true);
REVOKE ALL ON "RateLimitBucket" FROM biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RateLimitBucket" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "RateLimitBucket" TO biztrack_platform;
