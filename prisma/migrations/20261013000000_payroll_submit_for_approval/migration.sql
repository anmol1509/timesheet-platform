-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "returnNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

