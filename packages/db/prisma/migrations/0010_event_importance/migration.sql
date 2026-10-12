-- AlterTable
ALTER TABLE "SportsEventCache" ADD COLUMN "importance" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SportsEventCache_status_importance_idx" ON "SportsEventCache"("status", "importance");
