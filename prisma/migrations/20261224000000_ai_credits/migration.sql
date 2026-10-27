-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "aiMonthlyCredits" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN "aiWarnedMonth" TEXT,
ADD COLUMN "aiWarnedLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCreditGrant" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "note" TEXT,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_branchId_createdAt_idx" ON "AiUsage"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCreditGrant_branchId_grantedAt_idx" ON "AiCreditGrant"("branchId", "grantedAt");
