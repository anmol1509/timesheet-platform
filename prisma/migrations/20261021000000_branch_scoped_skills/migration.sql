-- The trade catalogue was one global list: any tenant's admin could rename or
-- delete a trade every other tenant used, and every tenant's demand requests
-- added their own trade names to it. A null branchId now marks the shared
-- catalogue (existing rows stay as they are, so a new client starts with the
-- standard trades); a branch can add trades of its own.
ALTER TABLE "Skill" ADD COLUMN "branchId" TEXT;

DROP INDEX IF EXISTS "Skill_name_key";
DROP INDEX IF EXISTS "Skill_code_key";
CREATE UNIQUE INDEX "Skill_branchId_name_key" ON "Skill"("branchId", "name");
CREATE UNIQUE INDEX "Skill_branchId_code_key" ON "Skill"("branchId", "code");
CREATE INDEX "Skill_branchId_idx" ON "Skill"("branchId");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
