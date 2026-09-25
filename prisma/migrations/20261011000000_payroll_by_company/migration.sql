-- DropIndex
DROP INDEX "PayrollRun_branchId_month_key";

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "advanceManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "advanceNote" TEXT,
ADD COLUMN     "deductionNote" TEXT,
ADD COLUMN     "manualDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "timesheetHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "payType" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "payType" TEXT,
ADD COLUMN     "wpsEstablishmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_branchId_companyId_month_key" ON "PayrollRun"("branchId", "companyId", "month");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

