-- People who own or sponsor a company are now stored once and linked to each company, with the role and (for owners)
-- the ownership share on the link. Existing owners and sponsors keep their ids, so uploaded documents stay attached.

CREATE TABLE "SupplierPartyLink" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ownershipPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "SupplierPartyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPartyLink_supplierId_partyId_role_key" ON "SupplierPartyLink"("supplierId", "partyId", "role");
CREATE INDEX "SupplierPartyLink_partyId_idx" ON "SupplierPartyLink"("partyId");
CREATE INDEX "SupplierPartyLink_branchId_idx" ON "SupplierPartyLink"("branchId");

ALTER TABLE "SupplierPartyLink" ADD CONSTRAINT "SupplierPartyLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPartyLink" ADD CONSTRAINT "SupplierPartyLink_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "SupplierParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPartyLink" ADD CONSTRAINT "SupplierPartyLink_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One link per existing owner or sponsor. A company with exactly one owner gets that owner at 100%; where there are
-- several owners the split is not known, so it is left unset for someone to fill in.
INSERT INTO "SupplierPartyLink" ("id", "role", "ownershipPercent", "supplierId", "partyId", "branchId")
SELECT 'lnk' || p."id", p."role",
       CASE WHEN p."role" = 'OWNER' AND (SELECT count(*) FROM "SupplierParty" q WHERE q."supplierId" = p."supplierId" AND q."role" = 'OWNER') = 1 THEN 100 ELSE NULL END,
       p."supplierId", p."id", p."branchId"
FROM "SupplierParty" p
WHERE p."supplierId" IS NOT NULL AND p."role" IS NOT NULL;

-- A person must no longer disappear with the first company they were entered under. The old columns are kept (empty of
-- meaning) so this change can be rolled back; a later migration can drop them.
ALTER TABLE "SupplierParty" DROP CONSTRAINT "SupplierParty_supplierId_fkey";
DROP INDEX "SupplierParty_supplierId_idx";
ALTER TABLE "SupplierParty" ALTER COLUMN "supplierId" DROP NOT NULL;
ALTER TABLE "SupplierParty" ALTER COLUMN "role" DROP NOT NULL;
