-- CreateTable
CREATE TABLE "VisaApplication" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "VisaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourCardApplication" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "LabourCardApplication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourCardApplication" ADD CONSTRAINT "LabourCardApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourCardApplication" ADD CONSTRAINT "LabourCardApplication_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
