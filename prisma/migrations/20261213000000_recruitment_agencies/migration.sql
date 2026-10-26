-- Recruitment agencies are told apart from other suppliers; candidates get a real sponsor company, a "last moved" date and a dropped state.
ALTER TABLE "Supplier" ADD COLUMN "isRecruitmentAgency" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CandidateOnboarding"
  ADD COLUMN "sponsorSupplierId" TEXT,
  ADD COLUMN "lastStageChangeAt" TIMESTAMP(3),
  ADD COLUMN "droppedAt" TIMESTAMP(3),
  ADD COLUMN "droppedReason" TEXT;
CREATE INDEX "CandidateOnboarding_sponsorSupplierId_idx" ON "CandidateOnboarding"("sponsorSupplierId");
ALTER TABLE "CandidateOnboarding" ADD CONSTRAINT "CandidateOnboarding_sponsorSupplierId_fkey"
  FOREIGN KEY ("sponsorSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Suppliers already used as an agency on a candidate (and not one of our own companies) are agencies.
UPDATE "Supplier" SET "isRecruitmentAgency" = true
WHERE "isOwnCompany" = false AND "id" IN (SELECT DISTINCT "agencyId" FROM "CandidateOnboarding" WHERE "agencyId" IS NOT NULL);

-- Days pending count from the last stage change, or from when the candidate was added if none was recorded.
UPDATE "CandidateOnboarding" c SET "lastStageChangeAt" = COALESCE(
  (SELECT MAX(h."updatedAt") FROM "CandidateOnboardingHistory" h WHERE h."onboardingId" = c."id"), c."createdAt");

-- The typed sponsor company becomes a link where it names one of our own companies exactly (ignoring case).
UPDATE "CandidateOnboarding" c SET "sponsorSupplierId" = s."id"
FROM "Supplier" s
WHERE c."sponsorCompany" IS NOT NULL AND s."isOwnCompany" = true AND s."branchId" = c."branchId" AND lower(trim(s."name")) = lower(trim(c."sponsorCompany"));
