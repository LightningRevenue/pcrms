-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "campaignMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_campaignMemberId_fkey" FOREIGN KEY ("campaignMemberId") REFERENCES "CampaignMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
