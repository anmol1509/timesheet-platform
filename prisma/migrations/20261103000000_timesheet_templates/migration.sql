-- A company's own versions of the timesheet layouts (additive: nothing existing changes).
CREATE TABLE "TimesheetTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseKey" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "TimesheetTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimesheetTemplate_branchId_name_key" ON "TimesheetTemplate"("branchId", "name");
CREATE INDEX "TimesheetTemplate_branchId_idx" ON "TimesheetTemplate"("branchId");

ALTER TABLE "TimesheetTemplate" ADD CONSTRAINT "TimesheetTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
