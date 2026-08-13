-- AlterTable
ALTER TABLE "TimesheetEntry" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- Backfill: TimesheetEntry has no direct FK to ClientInvoice (invoices are
-- client+month scoped, not entry-scoped), so a 1:1 LOCKED link can't be
-- proven. Any entry whose (clientId, month) matches an already-issued
-- invoice is marked CLIENT_APPROVED (billing already happened against it,
-- even though pre-existing invoices predate this workflow); everything else
-- stays DRAFT, the column default.
UPDATE "TimesheetEntry" te
SET "status" = 'CLIENT_APPROVED'
FROM "ClientInvoice" ci
WHERE te."clientId" = ci."clientId" AND te."month" = ci."month";
