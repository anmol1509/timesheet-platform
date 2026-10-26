-- An advance can be approved before anyone has chosen which month(s) to deduct it in. Until then payroll leaves it alone.
ALTER TABLE "EmployeeLoan" ADD COLUMN "planPending" BOOLEAN NOT NULL DEFAULT false;
