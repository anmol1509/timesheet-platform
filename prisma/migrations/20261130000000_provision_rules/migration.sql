CREATE TABLE "ProvisionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PER_PERSON',
    "amount" DECIMAL(14,2) NOT NULL,
    "everyMonths" INTEGER NOT NULL DEFAULT 12,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "ProvisionRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProvisionRule_branchId_idx" ON "ProvisionRule"("branchId");
ALTER TABLE "ProvisionRule" ADD CONSTRAINT "ProvisionRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
