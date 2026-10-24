CREATE TABLE "SupplierParty" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "SupplierParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hasExpiry" BOOLEAN NOT NULL DEFAULT true,
    "required" TEXT NOT NULL DEFAULT 'NO',
    "reminderDays" INTEGER[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierParty_supplierId_idx" ON "SupplierParty"("supplierId");
CREATE INDEX "SupplierParty_branchId_idx" ON "SupplierParty"("branchId");
CREATE UNIQUE INDEX "DocumentType_branchId_appliesTo_key_key" ON "DocumentType"("branchId", "appliesTo", "key");

ALTER TABLE "SupplierParty" ADD CONSTRAINT "SupplierParty_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierParty" ADD CONSTRAINT "SupplierParty_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentType" ADD CONSTRAINT "DocumentType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
