-- An own company can have its own time card template; blank uses the shared one on the company profile.
ALTER TABLE "Supplier" ADD COLUMN "timeCardSpec" JSONB;
