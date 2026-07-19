-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "templateId" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
