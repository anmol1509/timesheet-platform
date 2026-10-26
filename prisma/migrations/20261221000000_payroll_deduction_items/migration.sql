-- Named deductions typed on a payroll line, each with whether it shows on the payslip: [{label, amount, show}].
ALTER TABLE "PayrollLine" ADD COLUMN "deductionItems" JSONB;
