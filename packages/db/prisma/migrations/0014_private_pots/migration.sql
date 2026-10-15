-- Private pots. Added in place: rebuilding "Pot" (Prisma's default here) would
-- DROP a table that Prediction/PotStateTransition reference, which is unsafe on D1.
ALTER TABLE "Pot" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Pot_isPrivate_status_idx" ON "Pot"("isPrivate", "status");
