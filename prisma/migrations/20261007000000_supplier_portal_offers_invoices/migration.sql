-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "uploadedBySupplierId" TEXT,
ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupplierBill" ADD COLUMN     "submittedBySupplier" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DemandSupplierOffer" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "note" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "sentById" TEXT,
    "demandRequestId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,

    CONSTRAINT "DemandSupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandOfferLine" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(12,2),
    "offerId" TEXT NOT NULL,
    "demandRequestTradeId" TEXT NOT NULL,

    CONSTRAINT "DemandOfferLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandSupplierOffer_supplierId_status_idx" ON "DemandSupplierOffer"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DemandSupplierOffer_demandRequestId_supplierId_key" ON "DemandSupplierOffer"("demandRequestId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandOfferLine_offerId_demandRequestTradeId_key" ON "DemandOfferLine"("offerId", "demandRequestTradeId");

-- AddForeignKey
ALTER TABLE "DemandSupplierOffer" ADD CONSTRAINT "DemandSupplierOffer_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSupplierOffer" ADD CONSTRAINT "DemandSupplierOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandOfferLine" ADD CONSTRAINT "DemandOfferLine_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "DemandSupplierOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandOfferLine" ADD CONSTRAINT "DemandOfferLine_demandRequestTradeId_fkey" FOREIGN KEY ("demandRequestTradeId") REFERENCES "DemandRequestTrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

