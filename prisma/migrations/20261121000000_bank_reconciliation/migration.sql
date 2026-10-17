CREATE TABLE IF NOT EXISTS "BankStatementLine" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "balance" DECIMAL(14,2),
  "importHash" TEXT NOT NULL,
  "matchedAt" TIMESTAMP(3),
  "matchedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accountId" TEXT NOT NULL,
  "entryId" TEXT,
  CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankStatementLine_accountId_importHash_key" ON "BankStatementLine"("accountId", "importHash");
CREATE INDEX IF NOT EXISTS "BankStatementLine_accountId_date_idx" ON "BankStatementLine"("accountId", "date");
CREATE INDEX IF NOT EXISTS "BankStatementLine_entryId_idx" ON "BankStatementLine"("entryId");
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
