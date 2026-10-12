-- Payroll: exit dates and part-month pay, salary due dates, pay item categories,
-- salary revision history and final settlements. All additive.
ALTER TABLE "Employee" ADD COLUMN "exitDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "exitReason" TEXT;
ALTER TABLE "Branch" ADD COLUMN "payrollDueDays" INTEGER;
ALTER TABLE "PayrollRun" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "PayrollLine" ADD COLUMN "employedDays" INTEGER;
ALTER TABLE "PayrollLine" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "PayrollLine" ADD COLUMN "periodEnd" TIMESTAMP(3);
ALTER TABLE "PayrollLine" ADD COLUMN "items" JSONB;
ALTER TABLE "PayrollAdjustment" ADD COLUMN "category" TEXT;

CREATE TABLE "SalaryRevision" (
    "id" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "fixedBefore" DECIMAL(12,2) NOT NULL,
    "fixedAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "SalaryRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalaryRevision_employeeId_effectiveFrom_idx" ON "SalaryRevision"("employeeId", "effectiveFrom");
CREATE INDEX "SalaryRevision_branchId_idx" ON "SalaryRevision"("branchId");
ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinalSettlement" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "exitDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "serviceYears" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gratuity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unpaidSalaryDays" INTEGER NOT NULL DEFAULT 0,
    "unpaidSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "leavePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "noticePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loanBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "FinalSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinalSettlement_branchId_status_idx" ON "FinalSettlement"("branchId", "status");
CREATE INDEX "FinalSettlement_employeeId_idx" ON "FinalSettlement"("employeeId");
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
