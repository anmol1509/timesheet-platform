ALTER TABLE "Account" ADD COLUMN "bankId" TEXT;
CREATE UNIQUE INDEX "Account_bankId_key" ON "Account"("bankId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
