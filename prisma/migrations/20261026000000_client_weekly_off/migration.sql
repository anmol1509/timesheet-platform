-- Weekly off days can come from the client; an employee's own list only overrides it.
ALTER TABLE "Client" ADD COLUMN "weeklyOffDays" INTEGER[] DEFAULT ARRAY[5]::INTEGER[];
ALTER TABLE "Employee" ALTER COLUMN "weeklyOffDays" SET DEFAULT ARRAY[]::INTEGER[];
UPDATE "Employee" SET "weeklyOffDays" = ARRAY[]::INTEGER[];
