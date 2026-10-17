-- Which workmen compensation certificate names this worker (set when a certificate is read).
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "wcAttachmentId" TEXT;
