-- An ownership share is a whole percentage from 1 to 100 (or not yet chosen). NOT VALID checks every new or changed row
-- without failing the deploy on a row saved before this rule; Data health lists any such rows.
ALTER TABLE "SupplierPartyLink"
  ADD CONSTRAINT "SupplierPartyLink_ownershipPercent_range"
  CHECK ("ownershipPercent" IS NULL OR ("ownershipPercent" >= 1 AND "ownershipPercent" <= 100)) NOT VALID;
