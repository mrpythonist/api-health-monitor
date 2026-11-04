-- CreateTable: monitors, check_results, incidents
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "headers" JSONB,
    "incidentWebhookUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Monitor_slug_key" ON "Monitor"("slug");
CREATE INDEX "Monitor_enabled_idx" ON "Monitor"("enabled");

CREATE TABLE "CheckResult" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "error" VARCHAR(500),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckResult_monitorId_checkedAt_idx" ON "CheckResult"("monitorId", "checkedAt" DESC);

CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "cause" VARCHAR(500),
    "failedChecks" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Incident_monitorId_startedAt_idx" ON "Incident"("monitorId", "startedAt" DESC);
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- Foreign keys
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
