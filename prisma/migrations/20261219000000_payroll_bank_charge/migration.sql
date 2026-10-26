-- A bank charge typed against a worker on a payroll run, with a waive tick.
ALTER TABLE "PayrollLine" ADD COLUMN "bankCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN "bankChargeWaived" BOOLEAN NOT NULL DEFAULT false;
