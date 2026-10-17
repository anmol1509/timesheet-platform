-- The weekly off is a property of the project, not the client: nothing read the client's copy.
ALTER TABLE "Client" DROP COLUMN IF EXISTS "weeklyOffDays";

-- New projects are off on Sunday unless set otherwise. Existing projects on the old Friday default are moved just below.
ALTER TABLE "Project" ALTER COLUMN "weeklyOffDays" SET DEFAULT ARRAY[0]::INTEGER[];

-- Projects still on the old Friday default move to Sunday. Anything set to another day is left alone.
UPDATE "Project" SET "weeklyOffDays" = ARRAY[0]::INTEGER[] WHERE "weeklyOffDays" = ARRAY[5]::INTEGER[];
