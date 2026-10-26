-- A client's absence terms for timesheets: after two days off a month, AED 25 each (changeable per client).
ALTER TABLE "Client" ADD COLUMN "absentFreeDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Client" ADD COLUMN "absentDeductionPerDay" DECIMAL(10,2) NOT NULL DEFAULT 25;
