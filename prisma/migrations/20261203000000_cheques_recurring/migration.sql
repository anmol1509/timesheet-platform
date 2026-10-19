CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "chequeDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" TEXT,
    "partyName" TEXT NOT NULL,
    "bankId" TEXT,
    "counterAccountId" TEXT,
    "narration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clearedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Cheque_branchId_status_idx" ON "Cheque"("branchId", "status");
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RecurringEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "RecurringEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringEntry_branchId_idx" ON "RecurringEntry"("branchId");
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
