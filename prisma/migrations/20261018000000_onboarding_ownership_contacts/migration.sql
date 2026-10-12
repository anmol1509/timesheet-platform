-- AlterTable
ALTER TABLE "CandidateOnboarding" ADD COLUMN     "agencyContactId" TEXT;

-- CreateTable
CREATE TABLE "CandidateOnboardingStageTask" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "onboardingId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateOnboardingStageTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "agencyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateOnboardingStageTask_ownerId_idx" ON "CandidateOnboardingStageTask"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateOnboardingStageTask_onboardingId_stage_key" ON "CandidateOnboardingStageTask"("onboardingId", "stage");

-- CreateIndex
CREATE INDEX "AgencyContact_agencyId_idx" ON "AgencyContact"("agencyId");

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_agencyContactId_fkey" FOREIGN KEY ("agencyContactId") REFERENCES "AgencyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboardingStageTask" ADD CONSTRAINT "CandidateOnboardingStageTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboardingStageTask" ADD CONSTRAINT "CandidateOnboardingStageTask_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CandidateOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyContact" ADD CONSTRAINT "AgencyContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

