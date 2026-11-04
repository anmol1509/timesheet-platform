-- Days off with no deduction each month: one setting for hourly workers and one for monthly-salary workers.
-- Each company starts with the figure it already had, so nobody's pay changes until it is edited.
ALTER TABLE "Supplier" ADD COLUMN "absentFreeDaysHourly" INTEGER NOT NULL DEFAULT 2;
UPDATE "Supplier" SET "absentFreeDaysHourly" = "absentFreeDays";
