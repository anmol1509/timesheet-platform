-- Per-worker inventory/PPE issuance log — separate from
-- ProjectInventoryAssignment (item-to-project) since this tracks item-to-person,
-- so admins can see who currently holds an item and catch repeated/unreturned
-- issuance of the same PPE to one employee.

-- CreateTable
CREATE TABLE "EmployeeInventoryAssignment" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnDate" TIMESTAMP(3),
    "condition" TEXT,
    "notes" TEXT,
    "employeeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "EmployeeInventoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeInventoryAssignment_employeeId_idx" ON "EmployeeInventoryAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeInventoryAssignment_itemId_idx" ON "EmployeeInventoryAssignment"("itemId");

-- AddForeignKey
ALTER TABLE "EmployeeInventoryAssignment" ADD CONSTRAINT "EmployeeInventoryAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInventoryAssignment" ADD CONSTRAINT "EmployeeInventoryAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
