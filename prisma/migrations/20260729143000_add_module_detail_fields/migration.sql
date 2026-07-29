-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "retentionPercent" DOUBLE PRECISION,
ADD COLUMN     "secondContactEmail" TEXT,
ADD COLUMN     "secondContactName" TEXT,
ADD COLUMN     "secondContactPhone" TEXT,
ADD COLUMN     "tradeLicenseExpiry" TIMESTAMP(3),
ADD COLUMN     "tradeLicenseNumber" TEXT,
ADD COLUMN     "trn" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "joinDate" TIMESTAMP(3),
ADD COLUMN     "laborCardNumber" TEXT,
ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "sponsorName" TEXT,
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "wpsBankName" TEXT,
ADD COLUMN     "wpsIban" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "mohrePermitNumber" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tradeLicenseExpiry" TIMESTAMP(3),
ADD COLUMN     "tradeLicenseNumber" TEXT;
