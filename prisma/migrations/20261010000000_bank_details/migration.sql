-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AED';

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

