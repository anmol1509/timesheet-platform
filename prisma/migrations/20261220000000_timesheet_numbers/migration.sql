-- A running number on every generated timesheet (TS-2026-0001), counted per branch and year.
ALTER TABLE "GeneratedSheet" ADD COLUMN "sheetNo" TEXT;
CREATE INDEX "GeneratedSheet_branchId_sheetNo_idx" ON "GeneratedSheet"("branchId", "sheetNo");
CREATE TABLE "SheetCounter" (
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SheetCounter_pkey" PRIMARY KEY ("branchId","year")
);
