-- AlterEnum
ALTER TYPE "EmployeeStatus" ADD VALUE 'UNDER_MOBILISATION';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "mobilisationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "isOwnCompany" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");
