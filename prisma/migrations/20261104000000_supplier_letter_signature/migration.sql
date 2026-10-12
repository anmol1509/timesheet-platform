-- A supplier company's own signatory, signature and stamp, printed on letters issued on its letterhead.
ALTER TABLE "Supplier" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "signatoryTitle" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "signatureId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "stampId" TEXT;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_stampId_fkey" FOREIGN KEY ("stampId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
