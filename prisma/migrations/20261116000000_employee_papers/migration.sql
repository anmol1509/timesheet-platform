-- The arrival papers checklist on the employee, and the "papers pending" flag.
-- Additive: a new table and one defaulted column. Existing workers are not "papers pending".
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "papersPending" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "EmployeePaper" (
  "id" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "statusDate" TIMESTAMP(3),
  "referenceNo" TEXT,
  "expiryDate" TIMESTAMP(3),
  "remarks" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "employeeId" TEXT NOT NULL,
  CONSTRAINT "EmployeePaper_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePaper_employeeId_item_key" ON "EmployeePaper"("employeeId", "item");
CREATE INDEX IF NOT EXISTS "EmployeePaper_employeeId_idx" ON "EmployeePaper"("employeeId");
DO $$ BEGIN
  ALTER TABLE "EmployeePaper" ADD CONSTRAINT "EmployeePaper_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
