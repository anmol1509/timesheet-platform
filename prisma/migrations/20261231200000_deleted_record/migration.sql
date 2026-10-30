-- Copies of deleted workers and documents, kept for a while so a wrong delete can be restored.
CREATE TABLE "DeletedRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "snapshot" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT,
    "deletedById" TEXT NOT NULL,
    "deletedByName" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "restoredAt" TIMESTAMP(3),
    "restoredByName" TEXT,

    CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletedRecord_branchId_deletedAt_idx" ON "DeletedRecord"("branchId", "deletedAt");
CREATE INDEX "DeletedRecord_expiresAt_idx" ON "DeletedRecord"("expiresAt");
