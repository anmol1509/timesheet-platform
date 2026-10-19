ALTER TABLE "Branch" ADD COLUMN "provisionPolicy" JSONB;
ALTER TABLE "Employee" ADD COLUMN "skipGratuity" BOOLEAN NOT NULL DEFAULT false;
