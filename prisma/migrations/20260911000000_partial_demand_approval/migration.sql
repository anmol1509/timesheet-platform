-- Replaces the all-or-nothing approval flag with the number of heads approved.
--
-- Asking for ten and being given six is the normal answer from a client, and
-- the boolean could only record all ten.
--
-- Order matters: backfill from the flag BEFORE dropping it, or every existing
-- approval is lost. A line that was approved is taken to have had its whole
-- requested quantity agreed, which is exactly what the flag meant; one that was
-- not stays null, meaning undecided rather than refused.

ALTER TABLE "DemandRequestTrade" ADD COLUMN "approvedQuantity" INTEGER;

UPDATE "DemandRequestTrade" SET "approvedQuantity" = "quantity" WHERE "approved" = true;

ALTER TABLE "DemandRequestTrade" DROP COLUMN "approved";
