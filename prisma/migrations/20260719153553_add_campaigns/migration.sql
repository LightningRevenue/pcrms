-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "viaOpportunityId" TEXT,
    "addedById" TEXT,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignMember_personId_idx" ON "CampaignMember"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_campaignId_personId_key" ON "CampaignMember"("campaignId", "personId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
