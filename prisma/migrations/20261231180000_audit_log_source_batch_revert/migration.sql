-- Where an audit entry came from, which bulk action it belonged to, and whether it was put back.
ALTER TABLE "AuditLog" ADD COLUMN "source" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "batchId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "batchLabel" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "revertOfId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "revertedAt" TIMESTAMP(3);
ALTER TABLE "AuditLog" ADD COLUMN "revertedByName" TEXT;
CREATE INDEX "AuditLog_batchId_idx" ON "AuditLog"("batchId");
CREATE INDEX "AuditLog_branchId_userId_createdAt_idx" ON "AuditLog"("branchId", "userId", "createdAt");
