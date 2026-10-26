-- The day a note is about (chosen when adding it); older notes fall back to the day they were written.
ALTER TABLE "EmployeeNote" ADD COLUMN "noteDate" TIMESTAMP(3);
