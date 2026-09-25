-- AlterTable
ALTER TABLE "CandidateOnboarding" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emiratesId" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE INDEX "CandidateOnboarding_passportNumber_idx" ON "CandidateOnboarding"("passportNumber");

-- CreateIndex
CREATE INDEX "CandidateOnboarding_emiratesId_idx" ON "CandidateOnboarding"("emiratesId");
