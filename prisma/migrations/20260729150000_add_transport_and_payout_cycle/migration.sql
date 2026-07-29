-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "payoutCycleStartDay" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "type" TEXT,
    "capacity" INTEGER,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleProject" (
    "vehicleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "VehicleProject_pkey" PRIMARY KEY ("vehicleId","projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProject" ADD CONSTRAINT "VehicleProject_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProject" ADD CONSTRAINT "VehicleProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
