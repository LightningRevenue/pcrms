-- CreateTable
CREATE TABLE "EmailOpportunity" (
    "emailId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,

    CONSTRAINT "EmailOpportunity_pkey" PRIMARY KEY ("emailId","opportunityId")
);

-- CreateTable
CREATE TABLE "TaskOpportunity" (
    "taskId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,

    CONSTRAINT "TaskOpportunity_pkey" PRIMARY KEY ("taskId","opportunityId")
);

-- CreateIndex
CREATE INDEX "EmailOpportunity_opportunityId_idx" ON "EmailOpportunity"("opportunityId");

-- CreateIndex
CREATE INDEX "TaskOpportunity_opportunityId_idx" ON "TaskOpportunity"("opportunityId");

-- AddForeignKey
ALTER TABLE "EmailOpportunity" ADD CONSTRAINT "EmailOpportunity_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOpportunity" ADD CONSTRAINT "EmailOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOpportunity" ADD CONSTRAINT "TaskOpportunity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOpportunity" ADD CONSTRAINT "TaskOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
