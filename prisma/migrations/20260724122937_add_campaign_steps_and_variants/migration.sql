-- CreateTable
CREATE TABLE "CampaignVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CampaignVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStep" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStepBody" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "stepId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CampaignStepBody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStepRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "mailboxAccountId" TEXT,
    "memberId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CampaignStepRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable: CampaignMember gains variantId/enrolledAt
ALTER TABLE "CampaignMember" ADD COLUMN "variantId" TEXT,
ADD COLUMN "enrolledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignVariant_campaignId_order_idx" ON "CampaignVariant"("campaignId", "order");
CREATE INDEX "CampaignVariant_workspaceId_idx" ON "CampaignVariant"("workspaceId");

CREATE INDEX "CampaignStep_campaignId_order_idx" ON "CampaignStep"("campaignId", "order");
CREATE INDEX "CampaignStep_workspaceId_idx" ON "CampaignStep"("workspaceId");

CREATE UNIQUE INDEX "CampaignStepBody_stepId_variantId_key" ON "CampaignStepBody"("stepId", "variantId");
CREATE INDEX "CampaignStepBody_workspaceId_idx" ON "CampaignStepBody"("workspaceId");

CREATE UNIQUE INDEX "CampaignStepRun_memberId_stepId_key" ON "CampaignStepRun"("memberId", "stepId");
CREATE INDEX "CampaignStepRun_status_scheduledFor_idx" ON "CampaignStepRun"("status", "scheduledFor");
CREATE INDEX "CampaignStepRun_workspaceId_idx" ON "CampaignStepRun"("workspaceId");

-- AddForeignKey
ALTER TABLE "CampaignVariant" ADD CONSTRAINT "CampaignVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignVariant" ADD CONSTRAINT "CampaignVariant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignStepBody" ADD CONSTRAINT "CampaignStepBody_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStepBody" ADD CONSTRAINT "CampaignStepBody_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStepBody" ADD CONSTRAINT "CampaignStepBody_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CampaignVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStepBody" ADD CONSTRAINT "CampaignStepBody_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignStepRun" ADD CONSTRAINT "CampaignStepRun_mailboxAccountId_fkey" FOREIGN KEY ("mailboxAccountId") REFERENCES "MailboxAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStepRun" ADD CONSTRAINT "CampaignStepRun_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CampaignMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStepRun" ADD CONSTRAINT "CampaignStepRun_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStepRun" ADD CONSTRAINT "CampaignStepRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CampaignVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing Campaign that has a templateId becomes a 1-step, 1-variant
-- campaign carrying that template forward, so nothing that already ran (or is mid-flight)
-- breaks post-migration.
DO $$
DECLARE
  camp RECORD;
  new_step_id TEXT;
  new_variant_id TEXT;
BEGIN
  FOR camp IN SELECT "id", "templateId", "workspaceId" FROM "Campaign" WHERE "templateId" IS NOT NULL LOOP
    new_step_id := gen_random_uuid()::text;
    new_variant_id := gen_random_uuid()::text;

    INSERT INTO "CampaignStep" ("id", "order", "delayDays", "delayHours", "campaignId", "workspaceId")
    VALUES (new_step_id, 0, 0, 0, camp."id", camp."workspaceId");

    INSERT INTO "CampaignVariant" ("id", "name", "order", "campaignId", "workspaceId")
    VALUES (new_variant_id, 'Variant A', 0, camp."id", camp."workspaceId");

    INSERT INTO "CampaignStepBody" ("id", "templateId", "stepId", "variantId", "workspaceId")
    VALUES (gen_random_uuid()::text, camp."templateId", new_step_id, new_variant_id, camp."workspaceId");

    -- Every existing member of this campaign is retroactively enrolled onto the single
    -- backfilled step/variant, carrying over their old sendStatus/sentAt/sendError.
    UPDATE "CampaignMember"
    SET "variantId" = new_variant_id, "enrolledAt" = "addedAt"
    WHERE "campaignId" = camp."id";

    INSERT INTO "CampaignStepRun" ("id", "status", "scheduledFor", "executedAt", "error", "mailboxAccountId", "memberId", "stepId", "workspaceId")
    SELECT
      gen_random_uuid()::text,
      CASE cm."sendStatus" WHEN 'queued' THEN 'pending' ELSE cm."sendStatus" END,
      cm."addedAt",
      cm."sentAt",
      cm."sendError",
      NULL,
      cm."id",
      new_step_id,
      cm."workspaceId"
    FROM "CampaignMember" cm
    WHERE cm."campaignId" = camp."id";
  END LOOP;
END $$;

-- AlterTable: drop the old single-template/single-shot-send columns, now superseded by
-- CampaignStep/CampaignVariant/CampaignStepBody/CampaignStepRun above.
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_templateId_fkey";
ALTER TABLE "Campaign" DROP COLUMN "templateId";
ALTER TABLE "CampaignMember" DROP COLUMN "sendStatus",
DROP COLUMN "sentAt",
DROP COLUMN "sendError";
