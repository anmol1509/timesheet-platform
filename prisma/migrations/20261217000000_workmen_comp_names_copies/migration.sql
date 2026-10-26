-- Workmen compensation certificates keep the names read off them, and a copy of the file is filed on each covered worker.
ALTER TABLE "Attachment" ADD COLUMN "insuredNames" JSONB;
ALTER TABLE "Document" ADD COLUMN "sourceAttachmentId" TEXT;
CREATE INDEX "Document_sourceAttachmentId_idx" ON "Document"("sourceAttachmentId");
