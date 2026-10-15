-- Email becomes the sign-in id (verified by emailed code); phone is kept but
-- no longer verified, so it stops being unique. All changes are in place.
-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");
