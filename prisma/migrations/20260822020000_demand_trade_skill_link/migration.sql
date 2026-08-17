-- AlterTable
ALTER TABLE "DemandRequestTrade" ADD COLUMN     "skillId" TEXT;

-- AddForeignKey
ALTER TABLE "DemandRequestTrade" ADD CONSTRAINT "DemandRequestTrade_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
