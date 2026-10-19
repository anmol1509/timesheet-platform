ALTER TABLE "ClientInvoice" ADD COLUMN "paidBankId" TEXT;
ALTER TABLE "BillPayment" ADD COLUMN "bankId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "defaultReceiptBankId" TEXT, ADD COLUMN "defaultPaymentBankId" TEXT;
