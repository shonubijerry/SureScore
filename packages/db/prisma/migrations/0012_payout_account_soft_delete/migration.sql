-- AlterTable
ALTER TABLE "PayoutAccount" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "PayoutAccount_userId_deletedAt_idx" ON "PayoutAccount"("userId", "deletedAt");
