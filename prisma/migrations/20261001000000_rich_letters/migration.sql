-- AlterTable
ALTER TABLE "LetterTemplate" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'SITE',
ADD COLUMN     "bodyHtml" TEXT;

-- CreateTable
CREATE TABLE "IssuedLetter" (
    "id" TEXT NOT NULL,
    "refNo" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "inputs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "issuedById" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "IssuedLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuedLetter_refNo_key" ON "IssuedLetter"("refNo");

-- CreateIndex
CREATE INDEX "IssuedLetter_employeeId_createdAt_idx" ON "IssuedLetter"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "IssuedLetter_branchId_createdAt_idx" ON "IssuedLetter"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssuedLetter" ADD CONSTRAINT "IssuedLetter_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedLetter" ADD CONSTRAINT "IssuedLetter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LetterTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedLetter" ADD CONSTRAINT "IssuedLetter_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedLetter" ADD CONSTRAINT "IssuedLetter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

