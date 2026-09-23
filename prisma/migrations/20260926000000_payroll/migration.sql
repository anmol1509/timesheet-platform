-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "wpsEstablishmentId" TEXT,
ADD COLUMN     "wpsPayerBankId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "basicSalary" DECIMAL(12,2),
ADD COLUMN     "flatMonthlyRate" DECIMAL(12,2),
ADD COLUMN     "foodAllowance" DECIMAL(12,2),
ADD COLUMN     "housingAllowance" DECIMAL(12,2),
ADD COLUMN     "otMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.25,
ADD COLUMN     "otherAllowance" DECIMAL(12,2),
ADD COLUMN     "payStructure" TEXT,
ADD COLUMN     "paysOvertime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "transportAllowance" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "branchId" TEXT NOT NULL,
    "payerBankId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payStructure" TEXT NOT NULL,
    "daysInMonth" INTEGER NOT NULL,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "unpaidLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "normalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentNote" TEXT,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "personCode" TEXT,
    "bankName" TEXT,
    "routingCode" TEXT,
    "account" TEXT,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_branchId_month_key" ON "PayrollRun"("branchId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_runId_employeeId_key" ON "PayrollLine"("runId", "employeeId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_wpsPayerBankId_fkey" FOREIGN KEY ("wpsPayerBankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_payerBankId_fkey" FOREIGN KEY ("payerBankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Carry the old "reference only" basic salary across so nobody re-keys it.
-- HOURLY rates have no equivalent structure and are left untouched.
UPDATE "Employee"
SET "payStructure" = 'ITEMISED', "basicSalary" = ROUND("salaryRate"::numeric, 2)
WHERE "salaryType" = 'BASIC' AND "salaryRate" IS NOT NULL AND "payStructure" IS NULL;
