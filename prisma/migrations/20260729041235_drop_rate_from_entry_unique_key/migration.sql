-- DropIndex
DROP INDEX "TimesheetEntry_month_supplierId_employeeIdNo_trade_rate_key";

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_month_supplierId_employeeIdNo_trade_key" ON "TimesheetEntry"("month", "supplierId", "employeeIdNo", "trade");

