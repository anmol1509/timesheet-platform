-- A fixed AED rate per overtime hour, used instead of the multiplier when set.
ALTER TABLE "Employee" ADD COLUMN "otHourlyRate" DECIMAL(8,2);
