-- The date printed on a NOC, chosen when it is issued. Existing NOCs keep none.
ALTER TABLE "Noc" ADD COLUMN "letterDate" TIMESTAMP(3);
