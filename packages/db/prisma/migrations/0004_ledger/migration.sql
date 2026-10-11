-- CreateTable
CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entryKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "potId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountMinorUnits" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "reference" TEXT,
  "detail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_entryKey_key" ON "LedgerEntry" ("entryKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_idempotencyKey_idx" ON "LedgerEntry" ("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry" ("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_potId_idx" ON "LedgerEntry" ("potId");
