-- DropIndex
DROP INDEX "PayoutAccount_accountNumber_idx";

-- AlterTable
ALTER TABLE "PayoutAccount" ADD COLUMN "accountLast4" TEXT;
ALTER TABLE "PayoutAccount" ADD COLUMN "accountNumberHash" TEXT;

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutAccount_accountNumberHash_idx" ON "PayoutAccount"("accountNumberHash");
