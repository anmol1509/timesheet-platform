CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "cost" DECIMAL(14,2) NOT NULL,
    "salvage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchaseDate" DATE NOT NULL,
    "lifeMonths" INTEGER NOT NULL,
    "paidFromAccountId" TEXT,
    "disposedOn" DATE,
    "disposalAmount" DECIMAL(14,2),
    "disposalAccountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FixedAsset_branchId_idx" ON "FixedAsset"("branchId");
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
