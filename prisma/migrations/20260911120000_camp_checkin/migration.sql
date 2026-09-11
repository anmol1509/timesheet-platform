-- Accommodation module revamp: two-stage check-in flow (camp check-in, then
-- bed allocation) plus camp ownership type and supplier coordinator contact.

-- AlterTable
ALTER TABLE "Camp" ADD COLUMN "ownerType" TEXT NOT NULL DEFAULT 'OWN';
ALTER TABLE "Camp" ADD COLUMN "owningSupplierId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "coordinatorName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "coordinatorPhone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "coordinatorEmail" TEXT;

-- CreateSequence (standalone, not the table's primary key)
CREATE SEQUENCE "CampCheckIn_checkInNo_seq";

-- CreateTable
CREATE TABLE "CampCheckIn" (
    "id" TEXT NOT NULL,
    "checkInNo" INTEGER NOT NULL DEFAULT nextval('"CampCheckIn_checkInNo_seq"'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_IN',
    "checkInDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutDate" TIMESTAMP(3),
    "bedId" TEXT,
    "branchId" TEXT,

    CONSTRAINT "CampCheckIn_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "CampCheckIn_checkInNo_seq" OWNED BY "CampCheckIn"."checkInNo";

-- CreateIndex
CREATE UNIQUE INDEX "CampCheckIn_checkInNo_key" ON "CampCheckIn"("checkInNo");
CREATE UNIQUE INDEX "CampCheckIn_bedId_key" ON "CampCheckIn"("bedId");
CREATE INDEX "CampCheckIn_employeeId_idx" ON "CampCheckIn"("employeeId");
CREATE INDEX "CampCheckIn_campId_idx" ON "CampCheckIn"("campId");
CREATE INDEX "CampCheckIn_status_idx" ON "CampCheckIn"("status");

-- AddForeignKey
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_owningSupplierId_fkey" FOREIGN KEY ("owningSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampCheckIn" ADD CONSTRAINT "CampCheckIn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampCheckIn" ADD CONSTRAINT "CampCheckIn_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampCheckIn" ADD CONSTRAINT "CampCheckIn_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
