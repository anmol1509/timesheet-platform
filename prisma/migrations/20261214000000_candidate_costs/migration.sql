-- What each candidate cost to bring on board: agency fee, visa and permit fees, medical, ticket and so on.
CREATE TABLE "CandidateCost" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurredOn" DATE NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "onboardingId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "CandidateCost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidateCost_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "CandidateCost_onboardingId_idx" ON "CandidateCost"("onboardingId");
CREATE INDEX "CandidateCost_branchId_idx" ON "CandidateCost"("branchId");
ALTER TABLE "CandidateCost" ADD CONSTRAINT "CandidateCost_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CandidateOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
