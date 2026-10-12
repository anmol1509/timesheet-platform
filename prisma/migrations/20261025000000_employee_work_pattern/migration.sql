-- Per-employee working pattern for automatic overtime.
ALTER TABLE "Employee" ADD COLUMN "dailyHours" DECIMAL(4,2) NOT NULL DEFAULT 8;
ALTER TABLE "Employee" ADD COLUMN "weeklyOffDays" INTEGER[] DEFAULT ARRAY[5]::INTEGER[];
ALTER TABLE "Employee" ADD COLUMN "restOtMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5;
ALTER TABLE "PayrollLine" ADD COLUMN "restHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
