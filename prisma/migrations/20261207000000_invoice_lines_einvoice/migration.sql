-- AlterTable
ALTER TABLE "ClientInvoice" ADD COLUMN     "einvoiceError" TEXT,
ADD COLUMN     "einvoiceProvider" TEXT,
ADD COLUMN     "einvoiceRef" TEXT,
ADD COLUMN     "einvoiceSentAt" TIMESTAMP(3),
ADD COLUMN     "einvoiceStatus" TEXT;

-- CreateTable
CREATE TABLE "ClientInvoiceLine" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "employeeIdNo" TEXT,
    "trade" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "ClientInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientInvoiceLine_invoiceId_idx" ON "ClientInvoiceLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
