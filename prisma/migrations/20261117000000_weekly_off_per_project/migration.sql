-- The weekly off is a property of the project, not the client: nothing read the client's copy.
ALTER TABLE "Client" DROP COLUMN IF EXISTS "weeklyOffDays";

-- New projects are off on Sunday unless set otherwise. Existing projects keep what they have.
ALTER TABLE "Project" ALTER COLUMN "weeklyOffDays" SET DEFAULT ARRAY[0]::INTEGER[];
