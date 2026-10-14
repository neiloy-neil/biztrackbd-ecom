-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("key")
);

-- Row-Level Security and Role Grants
ALTER TABLE "PlatformConfig" ENABLE ROW LEVEL SECURITY;

-- Allow super admin platform role full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformConfig" TO biztrack_platform;

-- Allow store app role to read platform configs
GRANT SELECT ON "PlatformConfig" TO biztrack_app;
REVOKE INSERT, UPDATE, DELETE ON "PlatformConfig" FROM biztrack_app;
