-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "letterheadImageId" TEXT,
ADD COLUMN     "signatoryName" TEXT,
ADD COLUMN     "signatoryTitle" TEXT,
ADD COLUMN     "signatureId" TEXT,
ADD COLUMN     "stampId" TEXT;

-- AlterTable
ALTER TABLE "IssuedLetter" ADD COLUMN     "layout" JSONB;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_stampId_fkey" FOREIGN KEY ("stampId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_letterheadImageId_fkey" FOREIGN KEY ("letterheadImageId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

