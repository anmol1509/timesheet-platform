-- Why a worker left a camp, and checkouts set for a future date.
ALTER TABLE "AccommodationHistory" ADD COLUMN "checkOutReason" TEXT;
ALTER TABLE "AccommodationHistory" ADD COLUMN "checkOutNote" TEXT;
ALTER TABLE "AccommodationHistory" ADD COLUMN "plannedCheckOutDate" TIMESTAMP(3);
ALTER TABLE "AccommodationHistory" ADD COLUMN "plannedCheckOutReason" TEXT;
ALTER TABLE "AccommodationHistory" ADD COLUMN "plannedCheckOutNote" TEXT;
ALTER TABLE "CampCheckIn" ADD COLUMN "checkOutReason" TEXT;
