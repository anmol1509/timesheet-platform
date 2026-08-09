-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "labourApprovalStatus" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "invoiceApprovalStatus" TEXT NOT NULL DEFAULT 'Pending';

-- Grandfather existing suppliers: they're already in active use (labour
-- allocated to live projects today), so silently defaulting to 'Pending'
-- would lock them out. Only suppliers created after this migration start
-- at the 'Pending' column default.
UPDATE "Supplier" SET "approvalStatus" = 'Approved', "labourApprovalStatus" = 'Approved', "invoiceApprovalStatus" = 'Approved';
