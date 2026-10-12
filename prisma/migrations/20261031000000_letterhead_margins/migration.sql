-- Letterhead margins: how much clear space a letter leaves at the top and bottom when printed on a letterhead.
ALTER TABLE "Branch" ADD COLUMN "letterheadTopMm" INTEGER NOT NULL DEFAULT 65, ADD COLUMN "letterheadBottomMm" INTEGER NOT NULL DEFAULT 35;
ALTER TABLE "Supplier" ADD COLUMN "letterheadTopMm" INTEGER, ADD COLUMN "letterheadBottomMm" INTEGER;
