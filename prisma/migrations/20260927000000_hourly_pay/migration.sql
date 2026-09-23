-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hourlyRate" DECIMAL(12,2);


-- Carry legacy HOURLY reference rates across.
UPDATE "Employee"
SET "payStructure" = 'HOURLY', "hourlyRate" = ROUND("salaryRate"::numeric, 2)
WHERE "salaryType" = 'HOURLY' AND "salaryRate" IS NOT NULL AND "payStructure" IS NULL;
