-- CreateTable
CREATE TABLE "Lpo" (
    "id" TEXT NOT NULL,
    "lpoNumber" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "quantity" INTEGER,
    "trade" TEXT,
    "rate" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Lpo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lpo_lpoNumber_key" ON "Lpo"("lpoNumber");

-- CreateIndex
CREATE INDEX "Lpo_branchId_projectId_idx" ON "Lpo"("branchId", "projectId");

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: preserve every real production LPO reference off Project before
-- the flat lpoNo/lpoDate/closedLpo columns are dropped below. Where the same
-- lpoNo string repeats across multiple projects (not unique historically),
-- disambiguate with a numbered suffix so the new UNIQUE constraint holds.
WITH ranked AS (
  SELECT
    "id" AS "projectId",
    "clientId",
    "branchId",
    "lpoNo",
    "lpoDate",
    "closedLpo",
    ROW_NUMBER() OVER (PARTITION BY "lpoNo" ORDER BY "id") AS rn
  FROM "Project"
  WHERE "lpoNo" IS NOT NULL AND btrim("lpoNo") <> ''
)
INSERT INTO "Lpo" ("id", "lpoNumber", "validFrom", "status", "projectId", "clientId", "branchId", "createdAt")
SELECT
  gen_random_uuid()::text,
  CASE WHEN rn = 1 THEN "lpoNo" ELSE "lpoNo" || '-' || rn::text END,
  "lpoDate",
  CASE WHEN "closedLpo" THEN 'CLOSED' ELSE 'ACTIVE' END,
  "projectId",
  "clientId",
  "branchId",
  CURRENT_TIMESTAMP
FROM ranked;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "lpoNo",
DROP COLUMN "lpoDate",
DROP COLUMN "closedLpo";
