-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "currency" TEXT DEFAULT 'AED',
ADD COLUMN     "customer" TEXT,
ADD COLUMN     "grades" TEXT,
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "activeFrom" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "poBox" TEXT,
ADD COLUMN     "trn" TEXT;
