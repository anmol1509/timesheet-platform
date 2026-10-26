-- Payroll no longer takes a gas charge. Runs still in draft were calculated with one: give it back (net up, gas cleared).
-- Approved and paid runs are left exactly as they were.
UPDATE "PayrollLine" l
SET "net" = l."net" + l."gasCharge", "gasCharge" = 0
FROM "PayrollRun" r
WHERE r."id" = l."runId" AND r."status" = 'DRAFT' AND l."gasCharge" > 0;
