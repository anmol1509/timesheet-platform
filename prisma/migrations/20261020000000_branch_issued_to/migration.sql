-- Client invoices and supplier timesheets took their "issued by" name and tax
-- number from one global Settings row, so every tenant's documents named the
-- same company. The branch already holds the right values (name, trn); this
-- adds the one it lacked.
ALTER TABLE "Branch" ADD COLUMN "issuedTo" TEXT;

-- The shared row belonged to the original company, i.e. the oldest branch.
-- Carry it there so that branch's documents are unchanged; every other branch
-- starts blank and falls back to its own name.
UPDATE "Branch"
SET "issuedTo" = (SELECT "issuedTo" FROM "Settings" WHERE "id" = 'singleton'),
    "trn"      = COALESCE("trn", (SELECT "companyTrn" FROM "Settings" WHERE "id" = 'singleton'))
WHERE "id" = (SELECT "id" FROM "Branch" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
  AND EXISTS (SELECT 1 FROM "Settings" WHERE "id" = 'singleton');
