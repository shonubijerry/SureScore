-- Replace the unused placeholder Prediction table.
DROP TABLE "Prediction";

-- CreateTable
CREATE TABLE "Prediction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "potId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "homeGoals" INTEGER NOT NULL,
  "awayGoals" INTEGER NOT NULL,
  "firstGoalMinute" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Prediction_potId_fkey" FOREIGN KEY ("potId") REFERENCES "Pot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionEdit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "predictionId" TEXT NOT NULL,
  "homeGoals" INTEGER NOT NULL,
  "awayGoals" INTEGER NOT NULL,
  "firstGoalMinute" INTEGER,
  "replacedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PredictionEdit_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_potId_userId_key" ON "Prediction" ("potId", "userId");
CREATE INDEX "Prediction_userId_idx" ON "Prediction" ("userId");
CREATE INDEX "PredictionEdit_predictionId_replacedAt_idx" ON "PredictionEdit" ("predictionId", "replacedAt");
