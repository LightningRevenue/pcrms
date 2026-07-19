-- AlterTable
ALTER TABLE "CampaignMember" ADD COLUMN     "sendError" TEXT,
ADD COLUMN     "sendStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "sentAt" TIMESTAMP(3);
