-- CreateTable
CREATE TABLE "DemandRequest" (
    "id" TEXT NOT NULL,
    "requestNo" SERIAL NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'New',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT,
    "salesExecutive" TEXT,
    "accommodationStatus" TEXT,
    "transportationStatus" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,

    CONSTRAINT "DemandRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandRequestTrade" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shift" TEXT,
    "rate" DOUBLE PRECISION,
    "demandRequestId" TEXT NOT NULL,

    CONSTRAINT "DemandRequestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandRequestAllocation" (
    "id" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demandRequestTradeId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "DemandRequestAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandRequest_requestNo_key" ON "DemandRequest"("requestNo");

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequestTrade" ADD CONSTRAINT "DemandRequestTrade_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequestAllocation" ADD CONSTRAINT "DemandRequestAllocation_demandRequestTradeId_fkey" FOREIGN KEY ("demandRequestTradeId") REFERENCES "DemandRequestTrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequestAllocation" ADD CONSTRAINT "DemandRequestAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
