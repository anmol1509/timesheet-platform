-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_branchId_fkey";

-- DropForeignKey
ALTER TABLE "AssetMaintenance" DROP CONSTRAINT "AssetMaintenance_assetId_fkey";

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "AssetMaintenance";

