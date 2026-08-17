-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('RAISED', 'ACCEPTED', 'MOBILISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- CreateTable
CREATE TABLE "Demand" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "DemandStatus" NOT NULL DEFAULT 'RAISED',
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "branchId" TEXT NOT NULL,
    "requiredBy" TIMESTAMP(3),
    "notes" TEXT,
    "raisedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandLine" (
    "id" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shift" "ShiftType" NOT NULL DEFAULT 'DAY',

    CONSTRAINT "DemandLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandAssignment" (
    "id" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,

    CONSTRAINT "DemandAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Demand_reference_key" ON "Demand"("reference");

-- CreateIndex
CREATE INDEX "Demand_branchId_status_idx" ON "Demand"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DemandLine_demandId_skillId_shift_key" ON "DemandLine"("demandId", "skillId", "shift");

-- CreateIndex
CREATE INDEX "DemandAssignment_lineId_idx" ON "DemandAssignment"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandAssignment_demandId_employeeId_key" ON "DemandAssignment"("demandId", "employeeId");

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandLine" ADD CONSTRAINT "DemandLine_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandLine" ADD CONSTRAINT "DemandLine_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DemandLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
