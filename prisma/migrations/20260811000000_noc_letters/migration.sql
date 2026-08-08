-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "remarksText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Noc" (
    "id" TEXT NOT NULL,
    "docNo" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "mobilizeDate" TIMESTAMP(3),
    "remarks" TEXT,
    "displayFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demandRequestId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,

    CONSTRAINT "Noc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NocEmployee" (
    "id" TEXT NOT NULL,
    "nocId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "NocEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Noc_docNo_key" ON "Noc"("docNo");

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noc" ADD CONSTRAINT "Noc_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noc" ADD CONSTRAINT "Noc_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LetterTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noc" ADD CONSTRAINT "Noc_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noc" ADD CONSTRAINT "Noc_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NocEmployee" ADD CONSTRAINT "NocEmployee_nocId_fkey" FOREIGN KEY ("nocId") REFERENCES "Noc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NocEmployee" ADD CONSTRAINT "NocEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
