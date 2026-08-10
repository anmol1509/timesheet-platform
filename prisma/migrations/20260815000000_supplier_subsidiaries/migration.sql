-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "parentSupplierId" TEXT;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_parentSupplierId_fkey" FOREIGN KEY ("parentSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
