-- Records why a placement ended, on the row that already records the placement.
--
-- Both columns are nullable: every existing history row predates the
-- demobilisation screen and has no reason to state.

-- AlterTable
ALTER TABLE "EmployeeAssignmentHistory" ADD COLUMN     "demobilizationReason" TEXT;
ALTER TABLE "EmployeeAssignmentHistory" ADD COLUMN     "demobilizedByName" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeAssignmentHistory_demobilizedDate_idx" ON "EmployeeAssignmentHistory"("demobilizedDate");
