-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "payrollApprovalThreshold" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "PayrollLine_runId_projectId_idx" ON "PayrollLine"("runId", "projectId");

