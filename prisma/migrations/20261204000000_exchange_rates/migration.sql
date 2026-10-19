ALTER TABLE "JournalLine" ADD COLUMN "currency" TEXT, ADD COLUMN "foreignAmount" DECIMAL(14,2);
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExchangeRate_branchId_currency_date_key" ON "ExchangeRate"("branchId", "currency", "date");
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
