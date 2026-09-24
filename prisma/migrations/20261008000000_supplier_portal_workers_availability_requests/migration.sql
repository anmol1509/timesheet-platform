-- CreateTable
CREATE TABLE "WorkerSubmission" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "employeeId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "mobileNumber" TEXT,
    "trade" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3),
    "bloodGroup" TEXT,
    "passportNumber" TEXT NOT NULL,
    "emiratesId" TEXT NOT NULL,
    "passportExpiry" TIMESTAMP(3),
    "emiratesIdExpiry" TIMESTAMP(3),
    "visaExpiry" TIMESTAMP(3),
    "laborCardExpiry" TIMESTAMP(3),
    "medicalExpiry" TIMESTAMP(3),
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "WorkerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAvailability" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "SupplierAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierChangeRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "SupplierChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerSubmission_supplierId_status_idx" ON "WorkerSubmission"("supplierId", "status");

-- CreateIndex
CREATE INDEX "WorkerSubmission_branchId_status_idx" ON "WorkerSubmission"("branchId", "status");

-- CreateIndex
CREATE INDEX "SupplierAvailability_supplierId_date_idx" ON "SupplierAvailability"("supplierId", "date");

-- CreateIndex
CREATE INDEX "SupplierAvailability_branchId_date_idx" ON "SupplierAvailability"("branchId", "date");

-- CreateIndex
CREATE INDEX "SupplierChangeRequest_supplierId_status_idx" ON "SupplierChangeRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierChangeRequest_branchId_status_idx" ON "SupplierChangeRequest"("branchId", "status");

-- AddForeignKey
ALTER TABLE "WorkerSubmission" ADD CONSTRAINT "WorkerSubmission_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAvailability" ADD CONSTRAINT "SupplierAvailability_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierChangeRequest" ADD CONSTRAINT "SupplierChangeRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

