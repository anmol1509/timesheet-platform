-- Books: chart of accounts, double-entry journal, voucher numbering, opening date and lock date.
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "booksOpeningDate" DATE,
  ADD COLUMN IF NOT EXISTS "booksLockedUntil" DATE,
  ADD COLUMN IF NOT EXISTS "booksSyncedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "tag" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_branchId_code_key" ON "Account"("branchId", "code");
CREATE INDEX IF NOT EXISTS "Account_branchId_type_idx" ON "Account"("branchId", "type");

CREATE TABLE IF NOT EXISTS "JournalEntry" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "narration" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "voidReason" TEXT,
  "sourceKey" TEXT,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdByName" TEXT,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_branchId_number_key" ON "JournalEntry"("branchId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_branchId_sourceKey_key" ON "JournalEntry"("branchId", "sourceKey");
CREATE INDEX IF NOT EXISTS "JournalEntry_branchId_date_idx" ON "JournalEntry"("branchId", "date");

CREATE TABLE IF NOT EXISTS "JournalLine" (
  "id" TEXT NOT NULL,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "description" TEXT,
  "partyType" TEXT,
  "partyId" TEXT,
  "projectId" TEXT,
  "entryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx" ON "JournalLine"("accountId");
CREATE INDEX IF NOT EXISTS "JournalLine_entryId_idx" ON "JournalLine"("entryId");
CREATE INDEX IF NOT EXISTS "JournalLine_partyType_partyId_idx" ON "JournalLine"("partyType", "partyId");

CREATE TABLE IF NOT EXISTS "BookSequence" (
  "branchId" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "next" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BookSequence_pkey" PRIMARY KEY ("branchId", "prefix")
);

ALTER TABLE "Account" ADD CONSTRAINT "Account_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
