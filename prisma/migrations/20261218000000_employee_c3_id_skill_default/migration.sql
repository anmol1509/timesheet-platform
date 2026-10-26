-- A worker's C3 card ID, for the payroll C3 export.
ALTER TABLE "Employee" ADD COLUMN "c3Id" TEXT;

-- A trade with no "% known" recorded is a full 100% (it used to show a dash).
UPDATE "EmployeeSkill" SET "proficiencyPercent" = 100 WHERE "proficiencyPercent" IS NULL;
