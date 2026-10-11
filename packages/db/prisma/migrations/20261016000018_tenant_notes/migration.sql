-- CreateTable
CREATE TABLE "TenantNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantNote_tenantId_createdAt_idx" ON "TenantNote"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantNote" ADD CONSTRAINT "TenantNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: Platform-only table, revoked from store tenant app role
REVOKE ALL ON "TenantNote" FROM biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantNote" TO biztrack_platform;
