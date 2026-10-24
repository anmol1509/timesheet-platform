ALTER TABLE "Vehicle"
  ADD COLUMN "make" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "colour" TEXT,
  ADD COLUMN "chassisNumber" TEXT,
  ADD COLUMN "engineNumber" TEXT,
  ADD COLUMN "trafficFileNumber" TEXT,
  ADD COLUMN "plateEmirate" TEXT,
  ADD COLUMN "plateCategory" TEXT,
  ADD COLUMN "fuelType" TEXT,
  ADD COLUMN "ownership" TEXT NOT NULL DEFAULT 'OWNED',
  ADD COLUMN "lessor" TEXT,
  ADD COLUMN "odometerKm" INTEGER,
  ADD COLUMN "driverEmployeeId" TEXT;

CREATE INDEX "Vehicle_driverEmployeeId_idx" ON "Vehicle"("driverEmployeeId");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverEmployeeId_fkey" FOREIGN KEY ("driverEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
