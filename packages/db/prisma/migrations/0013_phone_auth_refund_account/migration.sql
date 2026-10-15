-- Phone sign-in: add phone + verification time, and make email optional.
-- SQLite cannot drop NOT NULL in place, and rebuilding "User" would fire
-- PayoutAccount's ON DELETE CASCADE (and hit RESTRICT on Pot/Prediction/
-- LedgerEntry) on D1, so the email column is swapped instead of the table.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "email_nullable" TEXT;
UPDATE "User" SET "email_nullable" = "email";
DROP INDEX "User_email_key";
ALTER TABLE "User" DROP COLUMN "email";
ALTER TABLE "User" RENAME COLUMN "email_nullable" TO "email";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Account a potter's refund is transferred to.
ALTER TABLE "Pot" ADD COLUMN "refundAccountId" TEXT;
