ALTER TYPE "EmployeeStatus" ADD VALUE IF NOT EXISTS 'ABSCONDING';
ALTER TABLE "Employee" ADD COLUMN "visaProfession" TEXT, ADD COLUMN "abscondedAt" TIMESTAMP(3), ADD COLUMN "abscondRemarks" TEXT, ADD COLUMN "abscondCaseStatus" TEXT;
