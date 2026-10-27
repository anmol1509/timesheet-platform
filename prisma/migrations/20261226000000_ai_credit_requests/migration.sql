-- CreateTable
CREATE TABLE "AiCreditRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "credits" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCreditRequest_branchId_status_idx" ON "AiCreditRequest"("branchId", "status");
