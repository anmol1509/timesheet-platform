-- Trade-wise pay per company; existing workers keep the pay on their own record.
ALTER TABLE "Employee" ADD COLUMN "payOverride" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Employee" SET "payOverride" = true WHERE "payStructure" IS NOT NULL;
CREATE TABLE "TradePay" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payStructure" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2),
    "housingAllowance" DECIMAL(12,2),
    "foodAllowance" DECIMAL(12,2),
    "transportAllowance" DECIMAL(12,2),
    "otherAllowance" DECIMAL(12,2),
    "flatMonthlyRate" DECIMAL(12,2),
    "hourlyRate" DECIMAL(12,2),
    "dailyHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "paysOvertime" BOOLEAN NOT NULL DEFAULT true,
    "otMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.25,
    "restOtMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradePay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradePay_supplierId_trade_key" ON "TradePay"("supplierId", "trade");
CREATE INDEX "TradePay_branchId_idx" ON "TradePay"("branchId");
ALTER TABLE "TradePay" ADD CONSTRAINT "TradePay_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradePay" ADD CONSTRAINT "TradePay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
