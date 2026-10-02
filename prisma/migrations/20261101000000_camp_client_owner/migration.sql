-- A camp can be provided by a client, besides being own or a supplier's.
ALTER TABLE "Camp" ADD COLUMN "owningClientId" TEXT;
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_owningClientId_fkey" FOREIGN KEY ("owningClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
