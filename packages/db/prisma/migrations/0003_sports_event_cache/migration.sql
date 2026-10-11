-- CreateTable
CREATE TABLE "SportsEventCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "league" TEXT NOT NULL,
  "homeTeam" TEXT NOT NULL,
  "awayTeam" TEXT NOT NULL,
  "kickoffTimeUtc" DATETIME NOT NULL,
  "status" TEXT NOT NULL,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "isFinalResultOfficial" BOOLEAN NOT NULL DEFAULT false,
  "freshness" TEXT NOT NULL DEFAULT 'cached',
  "lastRefreshedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SportsEventCache_provider_externalId_key" ON "SportsEventCache" ("provider", "externalId");

-- CreateIndex
CREATE INDEX "SportsEventCache_league_idx" ON "SportsEventCache" ("league");

-- CreateIndex
CREATE INDEX "SportsEventCache_status_idx" ON "SportsEventCache" ("status");

-- CreateIndex
CREATE INDEX "SportsEventCache_kickoffTimeUtc_idx" ON "SportsEventCache" ("kickoffTimeUtc");
