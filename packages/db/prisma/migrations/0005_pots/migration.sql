-- CreateTable
CREATE TABLE "Pot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "potterId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "prizeAmountMinorUnits" INTEGER NOT NULL,
  "winnerCount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "fundingReference" TEXT,
  "shareCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Pot_potterId_fkey" FOREIGN KEY ("potterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Pot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SportsEventCache" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PotStateTransition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "potId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PotStateTransition_potId_fkey" FOREIGN KEY ("potId") REFERENCES "Pot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Pot_shareCode_key" ON "Pot" ("shareCode");
CREATE INDEX "Pot_potterId_idx" ON "Pot" ("potterId");
CREATE INDEX "Pot_eventId_idx" ON "Pot" ("eventId");
CREATE INDEX "Pot_status_idx" ON "Pot" ("status");
CREATE INDEX "PotStateTransition_potId_createdAt_idx" ON "PotStateTransition" ("potId", "createdAt");
