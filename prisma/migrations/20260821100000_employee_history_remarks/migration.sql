-- Background captured on the new History step of the add-employee wizard.
-- Nullable and additive: existing rows are unaffected.
ALTER TABLE "Employee" ADD COLUMN "historyRemarks" TEXT;
