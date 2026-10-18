CREATE TABLE IF NOT EXISTS "RenewalCase" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "expiry" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "note" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ownerId" TEXT,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "RenewalCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RenewalCase_kind_subjectId_document_expiry_key" ON "RenewalCase"("kind", "subjectId", "document", "expiry");
CREATE INDEX IF NOT EXISTS "RenewalCase_branchId_status_idx" ON "RenewalCase"("branchId", "status");
CREATE INDEX IF NOT EXISTS "RenewalCase_ownerId_idx" ON "RenewalCase"("ownerId");
ALTER TABLE "RenewalCase" ADD CONSTRAINT "RenewalCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RenewalCase" ADD CONSTRAINT "RenewalCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
