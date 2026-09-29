-- Supplier, client and inventory-item names (and supplier/client codes) were
-- unique across the whole platform. Several manpower suppliers work for the same
-- big clients and stock the same items, so a second company could not add
-- "Emaar Properties" or "Safety Helmet" — and the error told them another
-- company already had it. They are now unique within a branch.
DROP INDEX IF EXISTS "Supplier_name_key";
DROP INDEX IF EXISTS "Supplier_code_key";
DROP INDEX IF EXISTS "Client_name_key";
DROP INDEX IF EXISTS "Client_code_key";
DROP INDEX IF EXISTS "InventoryItem_name_key";

CREATE UNIQUE INDEX "Supplier_branchId_name_key" ON "Supplier"("branchId", "name");
CREATE UNIQUE INDEX "Supplier_branchId_code_key" ON "Supplier"("branchId", "code");
CREATE UNIQUE INDEX "Client_branchId_name_key" ON "Client"("branchId", "name");
CREATE UNIQUE INDEX "Client_branchId_code_key" ON "Client"("branchId", "code");
CREATE UNIQUE INDEX "InventoryItem_branchId_name_key" ON "InventoryItem"("branchId", "name");
