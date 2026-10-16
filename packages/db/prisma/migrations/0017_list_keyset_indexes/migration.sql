-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_createdAt_id_idx" ON "LedgerEntry"("type", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_id_idx" ON "LedgerEntry"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Pot_updatedAt_id_idx" ON "Pot"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "Pot_status_updatedAt_id_idx" ON "Pot"("status", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Pot_potterId_createdAt_id_idx" ON "Pot"("potterId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_status_createdAt_id_idx" ON "ReconciliationFinding"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SportsEventCache_status_kickoffTimeUtc_id_idx" ON "SportsEventCache"("status", "kickoffTimeUtc", "id");

-- CreateIndex
CREATE INDEX "User_createdAt_id_idx" ON "User"("createdAt", "id");

-- CreateIndex
CREATE INDEX "User_role_createdAt_id_idx" ON "User"("role", "createdAt", "id");
