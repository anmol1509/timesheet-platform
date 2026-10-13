-- Onboarding: two more arrival papers (health insurance card, Emirates ID biometrics). Additive, defaulted.
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "healthCardStatus" TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE "CandidateOnboarding" ADD COLUMN IF NOT EXISTS "eidBiometricsStatus" TEXT NOT NULL DEFAULT 'Pending';
