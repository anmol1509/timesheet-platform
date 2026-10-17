-- Sales: follow-ups, versions, activity, optional taxes and cost, per-line price units.
ALTER TABLE "Quotation"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lostReason" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN "showCost" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adjustments" JSONB,
  ADD COLUMN "contactId" TEXT;

ALTER TABLE "QuotationLine"
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'MONTH',
  ADD COLUMN "unitLabel" TEXT,
  ADD COLUMN "unitsPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "durationMonths" DOUBLE PRECISION,
  ADD COLUMN "hoursPerDay" DOUBLE PRECISION,
  ADD COLUMN "costPerMonth" DOUBLE PRECISION,
  ADD COLUMN "costBreakdown" JSONB;

ALTER TABLE "Enquiry"
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lostReason" TEXT;

ALTER TABLE "Branch" ADD COLUMN "quoteSettings" JSONB;

CREATE TABLE "QuotationRevision" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByName" TEXT,
  "quotationId" TEXT NOT NULL,
  CONSTRAINT "QuotationRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotationRevision_quotationId_version_key" ON "QuotationRevision"("quotationId", "version");

CREATE TABLE "SalesActivity" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quotationId" TEXT,
  "enquiryId" TEXT,
  "branchId" TEXT,
  CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesActivity_quotationId_createdAt_idx" ON "SalesActivity"("quotationId", "createdAt");
CREATE INDEX "SalesActivity_enquiryId_createdAt_idx" ON "SalesActivity"("enquiryId", "createdAt");

CREATE TABLE "QuotationTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "intro" TEXT NOT NULL,
  "closing" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "QuotationTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuotationRevision" ADD CONSTRAINT "QuotationRevision_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationTemplate" ADD CONSTRAINT "QuotationTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
