-- How days off beyond the free days are charged, separately for monthly-salary and hourly workers.
-- Every company starts as it was: a fixed amount per day, the same for both groups.
ALTER TABLE "Supplier" ADD COLUMN "absentMethod" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Supplier" ADD COLUMN "absentPercent" DECIMAL(6,2) NOT NULL DEFAULT 100;
ALTER TABLE "Supplier" ADD COLUMN "absentBase" TEXT NOT NULL DEFAULT 'GROSS';
ALTER TABLE "Supplier" ADD COLUMN "absentDivisor" TEXT NOT NULL DEFAULT '30';
ALTER TABLE "Supplier" ADD COLUMN "absentDeductionPerDayHourly" DECIMAL(10,2) NOT NULL DEFAULT 30;
ALTER TABLE "Supplier" ADD COLUMN "absentMethodHourly" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Supplier" ADD COLUMN "absentPercentHourly" DECIMAL(6,2) NOT NULL DEFAULT 100;
ALTER TABLE "Supplier" ADD COLUMN "absentCapPercent" DECIMAL(5,2);
UPDATE "Supplier" SET "absentDeductionPerDayHourly" = "absentDeductionPerDay";
