-- Short hours on present working days: a per-company rule, a per-day override, and the result on each payroll line.
-- Additive and idempotent: existing rows keep working and the rule starts switched off.
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "shortfallMode" TEXT NOT NULL DEFAULT 'OFF';
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "shortfallHalfDayUnder" DECIMAL(4,2) NOT NULL DEFAULT 4;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "countShortfall" BOOLEAN;
ALTER TABLE "PayrollLine" ADD COLUMN IF NOT EXISTS "shortfallHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN IF NOT EXISTS "shortfallDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
