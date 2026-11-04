-- The time card: uploaded artwork of the pre-printed card, and its editable template.
ALTER TABLE "Branch" ADD COLUMN "timeCardImageId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "timeCardSpec" JSONB;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_timeCardImageId_fkey" FOREIGN KEY ("timeCardImageId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
