-- Onboarding: a shorter pipeline that depends on the kind of candidate.
-- Additive. Existing candidates are overseas hires; the three optional steps start as "Not Required", so nothing that was complete
-- becomes incomplete. The old post-arrival columns (medical, tawjeeh, iloe, contract, id/visa) are kept untouched: they move to the
-- employee's papers checklist in a later change.
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "candidateType" TEXT NOT NULL DEFAULT 'OVERSEAS';
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "hireApprovalStatus" TEXT NOT NULL DEFAULT 'Not Required';
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "interviewStatus" TEXT NOT NULL DEFAULT 'Not Required';
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "clientApprovalStatus" TEXT NOT NULL DEFAULT 'Not Required';
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "permitTransferStatus" TEXT NOT NULL DEFAULT 'Pending';

-- "Ready to join" now means the pre-arrival steps are done (not the post-arrival papers too), so recompute it for candidates who
-- already qualify under the shorter list.
UPDATE "CandidateOnboarding"
SET "readyToJoin" = true
WHERE NOT "joined" AND NOT "readyToJoin"
  AND "candidateType" = 'OVERSEAS'
  AND "offerStatus" = 'Accepted' AND "wppStatus" = 'Completed' AND "workPermitPaymentStatus" = 'Payment Completed'
  AND "entryPermitStatus" = 'Received' AND "arrivalStatus" = 'Arrived UAE';
