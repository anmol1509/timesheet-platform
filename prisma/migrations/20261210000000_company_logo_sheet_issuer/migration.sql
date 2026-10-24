ALTER TABLE "Supplier" ADD COLUMN "logoId" TEXT;
ALTER TABLE "GeneratedSheet" ADD COLUMN "issuedCompanyId" TEXT;

CREATE INDEX "GeneratedSheet_generatedById_generatedAt_idx" ON "GeneratedSheet"("generatedById", "generatedAt");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedSheet" ADD CONSTRAINT "GeneratedSheet_issuedCompanyId_fkey" FOREIGN KEY ("issuedCompanyId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
