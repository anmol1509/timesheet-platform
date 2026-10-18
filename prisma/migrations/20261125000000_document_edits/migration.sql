-- CreateTable
CREATE TABLE "DocumentEdit" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "editedById" TEXT,
    "editedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "DocumentEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentEdit_branchId_idx" ON "DocumentEdit"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEdit_kind_subjectId_key" ON "DocumentEdit"("kind", "subjectId");

-- AddForeignKey
ALTER TABLE "DocumentEdit" ADD CONSTRAINT "DocumentEdit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
