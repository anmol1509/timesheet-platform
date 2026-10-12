-- Camp and Vehicle were global, so every branch saw every other branch's
-- camps, rooms, beds, vehicles and routes. Scope them to a branch; Room,
-- Bed, Route, RouteStop and VehicleProject inherit through their parent.
ALTER TABLE "Camp" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "branchId" TEXT;

-- Existing rows all predate the second tenant, so they belong to the original
-- (oldest) branch. Resolved by query rather than hardcoding an id, so this
-- also applies cleanly to a fresh database or a differently-seeded one.
UPDATE "Camp" SET "branchId" = (SELECT "id" FROM "Branch" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1) WHERE "branchId" IS NULL;
UPDATE "Vehicle" SET "branchId" = (SELECT "id" FROM "Branch" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1) WHERE "branchId" IS NULL;

-- Names/plates were globally unique, which stopped two tenants having a
-- camp of the same name. Make them unique per branch instead.
DROP INDEX IF EXISTS "Camp_name_key";
DROP INDEX IF EXISTS "Vehicle_plateNumber_key";
CREATE UNIQUE INDEX "Camp_branchId_name_key" ON "Camp"("branchId", "name");
CREATE UNIQUE INDEX "Vehicle_branchId_plateNumber_key" ON "Vehicle"("branchId", "plateNumber");
CREATE INDEX "Camp_branchId_idx" ON "Camp"("branchId");
CREATE INDEX "Vehicle_branchId_idx" ON "Vehicle"("branchId");

ALTER TABLE "Camp" ADD CONSTRAINT "Camp_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
