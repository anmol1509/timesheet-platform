-- CreateTable
CREATE TABLE "EmployeeAssignmentHistory" (
    "id" TEXT NOT NULL,
    "branchName" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "mobilizedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demobilizedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "EmployeeAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationHistory" (
    "id" TEXT NOT NULL,
    "campName" TEXT,
    "roomName" TEXT,
    "bedLabel" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutDate" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "AccommodationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeAssignmentHistory_employeeId_idx" ON "EmployeeAssignmentHistory"("employeeId");

-- CreateIndex
CREATE INDEX "AccommodationHistory_employeeId_idx" ON "AccommodationHistory"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeAssignmentHistory" ADD CONSTRAINT "EmployeeAssignmentHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationHistory" ADD CONSTRAINT "AccommodationHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
