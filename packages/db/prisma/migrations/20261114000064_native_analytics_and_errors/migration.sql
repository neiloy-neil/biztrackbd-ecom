-- CreateEnum
CREATE TYPE "PlatformClientErrorStatus" AS ENUM ('NEW', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "PlatformVisitorSession" (
    "id" TEXT NOT NULL,
    "fbclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT NOT NULL,
    "exitPage" TEXT,
    "device" TEXT DEFAULT 'desktop',
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "convertedToSignup" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformVisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformVisitorEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "pageTitle" TEXT,
    "targetText" TEXT,
    "targetHref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformVisitorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformClientError" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "component" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "status" "PlatformClientErrorStatus" NOT NULL DEFAULT 'NEW',
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformClientError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformVisitorSession_startedAt_idx" ON "PlatformVisitorSession"("startedAt");
CREATE INDEX "PlatformVisitorSession_utmCampaign_idx" ON "PlatformVisitorSession"("utmCampaign");
CREATE INDEX "PlatformVisitorSession_utmSource_idx" ON "PlatformVisitorSession"("utmSource");
CREATE INDEX "PlatformVisitorSession_fbclid_idx" ON "PlatformVisitorSession"("fbclid");

-- CreateIndex
CREATE INDEX "PlatformVisitorEvent_sessionId_createdAt_idx" ON "PlatformVisitorEvent"("sessionId", "createdAt");
CREATE INDEX "PlatformVisitorEvent_eventType_createdAt_idx" ON "PlatformVisitorEvent"("eventType", "createdAt");
CREATE INDEX "PlatformVisitorEvent_pagePath_idx" ON "PlatformVisitorEvent"("pagePath");

-- CreateIndex
CREATE INDEX "PlatformClientError_status_lastOccurredAt_idx" ON "PlatformClientError"("status", "lastOccurredAt");
CREATE INDEX "PlatformClientError_pageUrl_idx" ON "PlatformClientError"("pageUrl");
CREATE INDEX "PlatformClientError_createdAt_idx" ON "PlatformClientError"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformVisitorEvent" ADD CONSTRAINT "PlatformVisitorEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlatformVisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformClientError" ADD CONSTRAINT "PlatformClientError_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlatformVisitorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable Row Level Security (RLS) on all three tables
ALTER TABLE "PlatformVisitorSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformVisitorEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformClientError" ENABLE ROW LEVEL SECURITY;

-- Grants: Platform role has full read/write, App role has ingest access
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformVisitorSession" TO biztrack_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformVisitorEvent" TO biztrack_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformClientError" TO biztrack_platform;

GRANT SELECT, INSERT, UPDATE ON "PlatformVisitorSession" TO biztrack_app;
GRANT INSERT ON "PlatformVisitorEvent" TO biztrack_app;
GRANT SELECT, INSERT, UPDATE ON "PlatformClientError" TO biztrack_app;

-- RLS Policies for biztrack_platform (SA dashboard)
CREATE POLICY "platform_manage_visitor_session" ON "PlatformVisitorSession" FOR ALL TO biztrack_platform USING (true) WITH CHECK (true);
CREATE POLICY "platform_manage_visitor_event" ON "PlatformVisitorEvent" FOR ALL TO biztrack_platform USING (true) WITH CHECK (true);
CREATE POLICY "platform_manage_client_error" ON "PlatformClientError" FOR ALL TO biztrack_platform USING (true) WITH CHECK (true);

-- RLS Policies for biztrack_app (public tracking ingestion)
CREATE POLICY "app_ingest_visitor_session" ON "PlatformVisitorSession" FOR ALL TO biztrack_app USING (true) WITH CHECK (true);
CREATE POLICY "app_ingest_visitor_event" ON "PlatformVisitorEvent" FOR ALL TO biztrack_app USING (true) WITH CHECK (true);
CREATE POLICY "app_ingest_client_error" ON "PlatformClientError" FOR ALL TO biztrack_app USING (true) WITH CHECK (true);
