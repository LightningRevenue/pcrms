-- CreateTable
CREATE TABLE "CampaignMailbox" (
    "id" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "mailboxAccountId" TEXT NOT NULL,

    CONSTRAINT "CampaignMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignMailbox_mailboxAccountId_idx" ON "CampaignMailbox"("mailboxAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMailbox_campaignId_mailboxAccountId_key" ON "CampaignMailbox"("campaignId", "mailboxAccountId");

-- AddForeignKey
ALTER TABLE "CampaignMailbox" ADD CONSTRAINT "CampaignMailbox_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMailbox" ADD CONSTRAINT "CampaignMailbox_mailboxAccountId_fkey" FOREIGN KEY ("mailboxAccountId") REFERENCES "MailboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
