-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "expenseApprovalLimit" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "outOfPocket" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reimbursedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SupplierBill" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "periodMonth" TEXT;

-- CreateTable
CREATE TABLE "ExpenseBudget" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthlyLimit" DECIMAL(12,2) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashTopUp" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PettyCashTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseBudget_branchId_category_key" ON "ExpenseBudget"("branchId", "category");

-- CreateIndex
CREATE INDEX "PettyCashTopUp_branchId_date_idx" ON "PettyCashTopUp"("branchId", "date");

-- AddForeignKey
ALTER TABLE "ExpenseBudget" ADD CONSTRAINT "ExpenseBudget_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTopUp" ADD CONSTRAINT "PettyCashTopUp_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

