-- Inventory variants: per-variant stock, each issuable to an employee with
-- its own issue date. An item with no variants keeps being issued directly
-- (variantId stays null on the assignment).

-- AlterTable
ALTER TABLE "EmployeeInventoryAssignment" ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "InventoryVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "InventoryVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryVariant_itemId_name_key" ON "InventoryVariant"("itemId", "name");

-- CreateIndex
CREATE INDEX "EmployeeInventoryAssignment_variantId_idx" ON "EmployeeInventoryAssignment"("variantId");

-- AddForeignKey
ALTER TABLE "InventoryVariant" ADD CONSTRAINT "InventoryVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInventoryAssignment" ADD CONSTRAINT "EmployeeInventoryAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "InventoryVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
