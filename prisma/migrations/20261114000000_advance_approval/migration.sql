-- Advances and loans: approval, the day the money was handed over, how it was paid, a recovery plan, and a reference number.
-- Additive. Existing rows count as approved and given on the day they were recorded, so recovery carries on as before.
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "givenDate" TIMESTAMP(3);
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "method" TEXT;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "schedule" JSONB;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "refNo" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLoan_refNo_key" ON "EmployeeLoan"("refNo");
-- Rows recorded before this change were handed over when recorded. (Only rows made before the cutoff.)
UPDATE "EmployeeLoan" SET "givenDate" = "createdAt" WHERE "givenDate" IS NULL AND "approvalStatus" = 'APPROVED' AND "createdAt" < TIMESTAMP '2026-10-13 00:00:00';
