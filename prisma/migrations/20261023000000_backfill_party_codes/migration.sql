-- Suppliers and clients created by a timesheet upload were saved without a
-- code. Number them within their branch, continuing after the highest code the
-- branch already uses.
WITH base AS (
  SELECT "branchId",
         COALESCE(MAX(SUBSTRING("code" FROM '^SUP(\d+)$')::int), 0) AS mx
  FROM "Supplier" GROUP BY "branchId"
), todo AS (
  SELECT s."id", b.mx + ROW_NUMBER() OVER (PARTITION BY s."branchId" ORDER BY s."createdAt", s."id") AS n
  FROM "Supplier" s JOIN base b ON b."branchId" IS NOT DISTINCT FROM s."branchId"
  WHERE s."code" IS NULL
)
UPDATE "Supplier" s SET "code" = 'SUP' || LPAD(todo.n::text, 3, '0') FROM todo WHERE s."id" = todo."id";

WITH base AS (
  SELECT "branchId",
         COALESCE(MAX(SUBSTRING("code" FROM '^CLI(\d+)$')::int), 0) AS mx
  FROM "Client" GROUP BY "branchId"
), todo AS (
  SELECT c."id", b.mx + ROW_NUMBER() OVER (PARTITION BY c."branchId" ORDER BY c."createdAt", c."id") AS n
  FROM "Client" c JOIN base b ON b."branchId" IS NOT DISTINCT FROM c."branchId"
  WHERE c."code" IS NULL
)
UPDATE "Client" c SET "code" = 'CLI' || LPAD(todo.n::text, 3, '0') FROM todo WHERE c."id" = todo."id";
