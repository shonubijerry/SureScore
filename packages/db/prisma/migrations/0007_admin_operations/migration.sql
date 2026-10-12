-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "potId" TEXT,
    "subject" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SettlementOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "potId" TEXT NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "firstGoalMinute" INTEGER,
    "reason" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeFrom" DATETIME NOT NULL,
    "potsChecked" INTEGER NOT NULL,
    "findingCount" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReconciliationFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "potId" TEXT,
    "userId" TEXT,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_potId_createdAt_idx" ON "AdminAuditLog"("potId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementOverride_potId_key" ON "SettlementOverride"("potId");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_startedAt_idx" ON "ReconciliationRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationFinding_fingerprint_key" ON "ReconciliationFinding"("fingerprint");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_status_severity_idx" ON "ReconciliationFinding"("status", "severity");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_potId_idx" ON "ReconciliationFinding"("potId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_status_createdAt_idx" ON "LedgerEntry"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_reference_idx" ON "LedgerEntry"("reference");

-- CreateIndex
CREATE INDEX "PayoutAccount_accountNumber_idx" ON "PayoutAccount"("accountNumber");
