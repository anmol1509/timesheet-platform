-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "account" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "emirate" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "paymentSchedule" TEXT,
ADD COLUMN     "poBox" TEXT,
ADD COLUMN     "vendorCode" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "accommodationType" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "inactiveReason" TEXT,
ADD COLUMN     "lastDemobilizedDate" TIMESTAMP(3),
ADD COLUMN     "nameInIdCard" TEXT,
ADD COLUMN     "previousId" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientProjectNo" TEXT,
ADD COLUMN     "closedLpo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactNo" TEXT,
ADD COLUMN     "dayShiftEnd" TEXT,
ADD COLUMN     "dayShiftStart" TEXT,
ADD COLUMN     "interTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalUse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobType" TEXT,
ADD COLUMN     "lpoDate" TIMESTAMP(3),
ADD COLUMN     "lpoNo" TEXT,
ADD COLUMN     "mainContractor" TEXT,
ADD COLUMN     "nightShiftEnd" TEXT,
ADD COLUMN     "nightShiftStart" TEXT,
ADD COLUMN     "noOfEmployeesRequired" INTEGER,
ADD COLUMN     "paymentType" TEXT,
ADD COLUMN     "salesExecutive" TEXT,
ADD COLUMN     "sponsorshipCompany" TEXT,
ADD COLUMN     "timesheetCollectionDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "account" TEXT,
ADD COLUMN     "allowManualLabourId" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCompany" TEXT,
ADD COLUMN     "bankEmirate" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "emirate" TEXT,
ADD COLUMN     "overtime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointOfContact" TEXT,
ADD COLUMN     "previousId" TEXT,
ADD COLUMN     "supplierAmountLimit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
