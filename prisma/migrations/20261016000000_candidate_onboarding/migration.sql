-- CreateTable
CREATE TABLE "CandidateOnboarding" (
    "id" TEXT NOT NULL,
    "candidateNo" SERIAL NOT NULL,
    "candidateName" TEXT NOT NULL,
    "trade" TEXT,
    "nationality" TEXT,
    "sponsorCompany" TEXT,
    "joiningTargetDate" TIMESTAMP(3),
    "offerStatus" TEXT NOT NULL DEFAULT 'Pending',
    "wppStatus" TEXT NOT NULL DEFAULT 'Pending',
    "workPermitPaymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "entryPermitStatus" TEXT NOT NULL DEFAULT 'Pending',
    "arrivalStatus" TEXT NOT NULL DEFAULT 'Travel Pending',
    "medicalStatus" TEXT NOT NULL DEFAULT 'Pending',
    "tawjeehStatus" TEXT NOT NULL DEFAULT 'Pending',
    "iloeStatus" TEXT NOT NULL DEFAULT 'Pending',
    "contractStatus" TEXT NOT NULL DEFAULT 'Pending',
    "idVisaStatus" TEXT NOT NULL DEFAULT 'Pending',
    "readyToJoin" BOOLEAN NOT NULL DEFAULT false,
    "joined" BOOLEAN NOT NULL DEFAULT false,
    "joiningDate" TIMESTAMP(3),
    "employeeId" TEXT,
    "remarks" TEXT,
    "agencyId" TEXT,
    "demandRequestId" TEXT,
    "projectId" TEXT,
    "branchId" TEXT NOT NULL,
    "assignedHrId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateOnboardingHistory" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "statusDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "remarks" TEXT,
    "onboardingId" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateOnboardingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateOnboarding_candidateNo_key" ON "CandidateOnboarding"("candidateNo");

-- CreateIndex
CREATE INDEX "CandidateOnboarding_branchId_idx" ON "CandidateOnboarding"("branchId");

-- CreateIndex
CREATE INDEX "CandidateOnboarding_agencyId_idx" ON "CandidateOnboarding"("agencyId");

-- CreateIndex
CREATE INDEX "CandidateOnboarding_readyToJoin_joined_idx" ON "CandidateOnboarding"("readyToJoin", "joined");

-- CreateIndex
CREATE INDEX "CandidateOnboardingHistory_onboardingId_stage_idx" ON "CandidateOnboardingHistory"("onboardingId", "stage");

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_assignedHrId_fkey" FOREIGN KEY ("assignedHrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboardingHistory" ADD CONSTRAINT "CandidateOnboardingHistory_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CandidateOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateOnboardingHistory" ADD CONSTRAINT "CandidateOnboardingHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

