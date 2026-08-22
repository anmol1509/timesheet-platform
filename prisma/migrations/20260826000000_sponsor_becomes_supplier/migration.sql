-- Folds SponsorshipCompany into Supplier.
--
-- A visa sponsor is a company we already hold as a Supplier — usually one of
-- our own subsidiaries — so maintaining a second list of the same companies was
-- duplication. The link itself is kept, because the sponsor and the employer
-- are not always the same company; it just points at Supplier now.
--
-- Order matters: create the suppliers and repoint the employees BEFORE dropping
-- the old column, or the sponsor is lost.

ALTER TABLE "Employee" ADD COLUMN "sponsorSupplierId" TEXT;

-- Reuses the sponsorship company's id as the supplier id, so the mapping below
-- is a straight join and any external reference still resolves.
INSERT INTO "Supplier" ("id", "name", "branchId", "tradeLicenseNumber")
SELECT sc."id", sc."name", sc."branchId", sc."tradeLicenseNumber"
FROM "SponsorshipCompany" sc
WHERE NOT EXISTS (
  SELECT 1 FROM "Supplier" s WHERE lower(s."name") = lower(sc."name")
);

-- Point each employee at the supplier carrying their sponsor's name, whether it
-- was just created above or already existed.
UPDATE "Employee" e
SET "sponsorSupplierId" = s."id"
FROM "SponsorshipCompany" sc
JOIN "Supplier" s ON lower(s."name") = lower(sc."name")
WHERE e."sponsorshipCompanyId" = sc."id";

ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_sponsorshipCompanyId_fkey";
ALTER TABLE "Employee" DROP COLUMN "sponsorshipCompanyId";

ALTER TABLE "SponsorshipCompany" DROP CONSTRAINT IF EXISTS "SponsorshipCompany_branchId_fkey";
DROP TABLE "SponsorshipCompany";

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sponsorSupplierId_fkey"
  FOREIGN KEY ("sponsorSupplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
