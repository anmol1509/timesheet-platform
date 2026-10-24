CREATE TABLE "DocumentReminder" (
    "id" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "DocumentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentReminder_refKey_threshold_key" ON "DocumentReminder"("refKey", "threshold");
CREATE INDEX "DocumentReminder_branchId_idx" ON "DocumentReminder"("branchId");
