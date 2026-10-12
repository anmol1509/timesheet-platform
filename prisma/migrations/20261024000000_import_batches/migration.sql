-- The import wizard keeps each run as a batch, with a record of what it created
-- or changed so the whole import can be undone.
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileData" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mapping" TEXT,
    "options" TEXT,
    "summary" TEXT,
    "progressDone" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "undoUntil" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),
    "branchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportChange" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,

    CONSTRAINT "ImportChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_branchId_createdAt_idx" ON "ImportBatch"("branchId", "createdAt");
CREATE INDEX "ImportChange_batchId_seq_idx" ON "ImportChange"("batchId", "seq");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportChange" ADD CONSTRAINT "ImportChange_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
