-- Backfill: any Project linked to a Site with no address of its own picks up
-- the Site's name as its address, so nothing is lost once Site is dropped.
UPDATE "Project" p
SET "address" = s."name"
FROM "Site" s
WHERE p."siteId" = s."id"
  AND (p."address" IS NULL OR p."address" = '');

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_siteId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "siteId";

-- DropTable
DROP TABLE "Site";
