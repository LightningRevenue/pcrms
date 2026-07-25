-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "disposition" TEXT;

-- AlterTable
ALTER TABLE "CampaignMember" ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "CustomReport" ADD COLUMN     "dateGranularity" TEXT NOT NULL DEFAULT 'day';

-- AlterTable
ALTER TABLE "DashboardWidget" ADD COLUMN     "dateGranularity" TEXT NOT NULL DEFAULT 'day';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "expectedCloseDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PipelineStage" ADD COLUMN     "probability" INTEGER;

-- AlterTable
ALTER TABLE "SequenceEnrollment" ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CallOpportunity" (
    "callId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CallOpportunity_pkey" PRIMARY KEY ("callId","opportunityId")
);

-- CreateIndex
CREATE INDEX "CallOpportunity_opportunityId_idx" ON "CallOpportunity"("opportunityId");

-- CreateIndex
CREATE INDEX "CallOpportunity_workspaceId_idx" ON "CallOpportunity"("workspaceId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOpportunity" ADD CONSTRAINT "CallOpportunity_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOpportunity" ADD CONSTRAINT "CallOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOpportunity" ADD CONSTRAINT "CallOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
