-- Replaces the single Employee.historyRemarks field (added earlier the same
-- day, never populated) with repeatable notes: each note carries its own
-- remarks and can have files attached via Document.noteId.

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "noteId" TEXT;
-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "historyRemarks";
-- CreateTable
CREATE TABLE "EmployeeNote" (
    "id" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "EmployeeNote_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "EmployeeNote_employeeId_createdAt_idx" ON "EmployeeNote"("employeeId", "createdAt");
-- AddForeignKey
ALTER TABLE "EmployeeNote" ADD CONSTRAINT "EmployeeNote_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EmployeeNote" ADD CONSTRAINT "EmployeeNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "EmployeeNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
