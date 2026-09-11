-- Supplier code, same shape as Client.code — shown on the Create Check-In
-- table/PDF alongside the employee's project.

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "code" TEXT;

-- Backfill every existing supplier with a code, same "PREFIX + zero-padded
-- sequence" shape as Client.code's nextClientCode() — new suppliers get
-- theirs the same way going forward, ordered by creation so existing codes
-- read like a stable history rather than shuffling on every insert.
UPDATE "Supplier" s
SET "code" = 'SUP' || LPAD(sub.rn::text, 3, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn FROM "Supplier"
) sub
WHERE s."id" = sub."id";

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
