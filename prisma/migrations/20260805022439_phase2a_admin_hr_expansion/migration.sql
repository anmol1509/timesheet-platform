-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('STAFF', 'SITE_STAFF');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "address" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "category" "EmployeeCategory" NOT NULL DEFAULT 'SITE_STAFF',
ADD COLUMN     "cicpaExpiry" TIMESTAMP(3),
ADD COLUMN     "cicpaIssueDate" TIMESTAMP(3),
ADD COLUMN     "cicpaLocation" TEXT,
ADD COLUMN     "cicpaNumber" TEXT,
ADD COLUMN     "cicpaStatus" TEXT,
ADD COLUMN     "drivingLicenceExpiry" TIMESTAMP(3),
ADD COLUMN     "drivingLicenceIssueDate" TIMESTAMP(3),
ADD COLUMN     "drivingLicenceNumber" TEXT,
ADD COLUMN     "drivingLicenceStatus" TEXT,
ADD COLUMN     "drivingLicenceType" TEXT,
ADD COLUMN     "eidStatus" TEXT,
ADD COLUMN     "insuranceCardNumber" TEXT,
ADD COLUMN     "insuranceCardType" TEXT,
ADD COLUMN     "insuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "insuranceIssueDate" TIMESTAMP(3),
ADD COLUMN     "insuranceServiceProvider" TEXT,
ADD COLUMN     "insuranceStatus" TEXT,
ADD COLUMN     "laborCardPersonalNo" TEXT,
ADD COLUMN     "laborCardStatus" TEXT,
ADD COLUMN     "medicalStatus" TEXT,
ADD COLUMN     "molPersonCode" TEXT,
ADD COLUMN     "passportReleaseDate" TIMESTAMP(3),
ADD COLUMN     "passportReturnDate" TIMESTAMP(3),
ADD COLUMN     "passportStatus" TEXT,
ADD COLUMN     "sponsorshipCompanyId" TEXT,
ADD COLUMN     "visaDesignation" TEXT,
ADD COLUMN     "visaNumber" TEXT,
ADD COLUMN     "visaStampingDate" TIMESTAMP(3),
ADD COLUMN     "visaStatus" TEXT,
ADD COLUMN     "visaType" TEXT,
ADD COLUMN     "wpsAccountHolderName" TEXT,
ADD COLUMN     "wpsAccountNumber" TEXT,
ADD COLUMN     "wpsPaymentMode" TEXT,
ADD COLUMN     "wpsRoutingCode" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "displayInEss" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "EmployeeSkill" ADD COLUMN     "proficiencyPercent" INTEGER,
ADD COLUMN     "rate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SponsorshipCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "tradeLicenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "SponsorshipCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "abbreviation" TEXT,
    "accountNo" TEXT,
    "ibanNo" TEXT,
    "routingCode" TEXT,
    "swiftCode" TEXT,
    "bankBranch" TEXT,
    "address" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeVaccination" (
    "id" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER,
    "date" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "EmployeeVaccination_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SponsorshipCompany" ADD CONSTRAINT "SponsorshipCompany_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sponsorshipCompanyId_fkey" FOREIGN KEY ("sponsorshipCompanyId") REFERENCES "SponsorshipCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeVaccination" ADD CONSTRAINT "EmployeeVaccination_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

