-- Backfill: every row created before multi-tenancy belongs to a single "default" workspace.
-- The very first User (by createdAt) becomes its owner; everyone else is a member.
-- This mirrors ensureWorkspaceMembership()'s "first user ever = owner" rule in application code.
DO $$
DECLARE
  default_workspace_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Workspace" LIMIT 1) THEN
    default_workspace_id := 'default-workspace';
    INSERT INTO "Workspace" (id, name, "createdAt") VALUES (default_workspace_id, 'Workspace', now());
  ELSE
    SELECT id INTO default_workspace_id FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1;
  END IF;

  INSERT INTO "WorkspaceMember" (id, role, "workspaceId", "userId")
  SELECT
    'wm-' || u.id,
    CASE WHEN u.id = (SELECT id FROM "User" ORDER BY id ASC LIMIT 1) THEN 'owner' ELSE 'member' END,
    default_workspace_id,
    u.id
  FROM "User" u
  WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."userId" = u.id);

  -- Add every workspace-scoped column as nullable first, backfill it to the default
  -- workspace, then tighten to NOT NULL below — required because these tables already
  -- hold real rows (see the row counts `prisma migrate diff` reported).
  ALTER TABLE "Activity" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Call" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Campaign" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "CampaignMailbox" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "CampaignMember" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Company" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "CustomFieldDefinition" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "CustomFieldValue" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Dashboard" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Email" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "EmailOpen" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "EmailOpportunity" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "EmailTemplate" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Favorite" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "ImportBatch" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "List" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "ListItem" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "MailboxAccount" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Note" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "NoteOpportunity" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Notification" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Opportunity" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Person" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "PipelineStage" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Playbook" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "PlaybookSection" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Sequence" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "SequenceEnrollment" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "SequenceStep" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "SequenceStepRun" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Task" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "TaskOpportunity" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "TwilioAccount" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "UserMailboxPreference" ADD COLUMN "workspaceId" TEXT;
  ALTER TABLE "Workflow" ADD COLUMN "workspaceId" TEXT;

  UPDATE "Activity" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Call" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Campaign" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "CampaignMailbox" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "CampaignMember" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Company" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "CustomFieldDefinition" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "CustomFieldValue" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Dashboard" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Email" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "EmailOpen" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "EmailOpportunity" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "EmailTemplate" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Favorite" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "ImportBatch" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "List" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "ListItem" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "MailboxAccount" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Note" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "NoteOpportunity" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Notification" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Opportunity" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Person" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "PipelineStage" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Playbook" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "PlaybookSection" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Sequence" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "SequenceEnrollment" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "SequenceStep" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "SequenceStepRun" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Task" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "TaskOpportunity" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "TwilioAccount" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "UserMailboxPreference" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
  UPDATE "Workflow" SET "workspaceId" = default_workspace_id WHERE "workspaceId" IS NULL;
END $$;

-- Drop the old global-uniqueness indexes now superseded by workspace-scoped ones.
DROP INDEX "CustomFieldDefinition_objectType_key_key";
DROP INDEX "Dashboard_kind_key";
DROP INDEX "PipelineStage_label_key";

-- Tighten every backfilled column to NOT NULL now that no row is left with a null value.
ALTER TABLE "Activity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Call" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CampaignMailbox" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CampaignMember" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CustomFieldDefinition" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CustomFieldValue" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Dashboard" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Email" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EmailOpen" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EmailOpportunity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EmailTemplate" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Favorite" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ImportBatch" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "List" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ListItem" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "MailboxAccount" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NoteOpportunity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Person" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PipelineStage" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Playbook" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PlaybookSection" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Sequence" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SequenceEnrollment" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SequenceStep" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SequenceStepRun" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TaskOpportunity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TwilioAccount" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "UserMailboxPreference" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Workflow" ALTER COLUMN "workspaceId" SET NOT NULL;

-- TwilioAccount.id was hardcoded to "default" pre-multi-tenancy; now one row per workspace,
-- keyed by a normal cuid default going forward (existing row keeps its old id value, which
-- is still a valid primary key value, just no longer the DEFAULT for new rows).
ALTER TABLE "TwilioAccount" ALTER COLUMN "id" DROP DEFAULT;

-- New workspace-scoped indexes / unique constraints.
CREATE INDEX "Activity_workspaceId_idx" ON "Activity"("workspaceId");
CREATE INDEX "Call_workspaceId_idx" ON "Call"("workspaceId");
CREATE INDEX "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");
CREATE INDEX "CampaignMailbox_workspaceId_idx" ON "CampaignMailbox"("workspaceId");
CREATE INDEX "CampaignMember_workspaceId_idx" ON "CampaignMember"("workspaceId");
CREATE INDEX "Company_workspaceId_idx" ON "Company"("workspaceId");
CREATE UNIQUE INDEX "CustomFieldDefinition_workspaceId_objectType_key_key" ON "CustomFieldDefinition"("workspaceId", "objectType", "key");
CREATE INDEX "CustomFieldValue_workspaceId_idx" ON "CustomFieldValue"("workspaceId");
CREATE UNIQUE INDEX "Dashboard_workspaceId_kind_key" ON "Dashboard"("workspaceId", "kind");
CREATE INDEX "Email_workspaceId_idx" ON "Email"("workspaceId");
CREATE INDEX "EmailOpen_workspaceId_idx" ON "EmailOpen"("workspaceId");
CREATE INDEX "EmailOpportunity_workspaceId_idx" ON "EmailOpportunity"("workspaceId");
CREATE INDEX "EmailTemplate_workspaceId_idx" ON "EmailTemplate"("workspaceId");
CREATE INDEX "Favorite_workspaceId_idx" ON "Favorite"("workspaceId");
CREATE INDEX "ImportBatch_workspaceId_idx" ON "ImportBatch"("workspaceId");
CREATE INDEX "List_workspaceId_idx" ON "List"("workspaceId");
CREATE INDEX "ListItem_workspaceId_idx" ON "ListItem"("workspaceId");
CREATE INDEX "MailboxAccount_workspaceId_idx" ON "MailboxAccount"("workspaceId");
CREATE INDEX "Note_workspaceId_idx" ON "Note"("workspaceId");
CREATE INDEX "NoteOpportunity_workspaceId_idx" ON "NoteOpportunity"("workspaceId");
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");
CREATE INDEX "Opportunity_workspaceId_idx" ON "Opportunity"("workspaceId");
CREATE INDEX "Person_workspaceId_idx" ON "Person"("workspaceId");
CREATE UNIQUE INDEX "PipelineStage_workspaceId_label_key" ON "PipelineStage"("workspaceId", "label");
CREATE INDEX "Playbook_workspaceId_idx" ON "Playbook"("workspaceId");
CREATE INDEX "PlaybookSection_workspaceId_idx" ON "PlaybookSection"("workspaceId");
CREATE INDEX "Sequence_workspaceId_idx" ON "Sequence"("workspaceId");
CREATE INDEX "SequenceEnrollment_workspaceId_idx" ON "SequenceEnrollment"("workspaceId");
CREATE INDEX "SequenceStep_workspaceId_idx" ON "SequenceStep"("workspaceId");
CREATE INDEX "SequenceStepRun_workspaceId_idx" ON "SequenceStepRun"("workspaceId");
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");
CREATE INDEX "TaskOpportunity_workspaceId_idx" ON "TaskOpportunity"("workspaceId");
CREATE UNIQUE INDEX "TwilioAccount_workspaceId_key" ON "TwilioAccount"("workspaceId");
CREATE INDEX "UserMailboxPreference_workspaceId_idx" ON "UserMailboxPreference"("workspaceId");
CREATE INDEX "Workflow_workspaceId_idx" ON "Workflow"("workspaceId");

-- Foreign keys tying every workspace-scoped table back to Workspace.
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "List" ADD CONSTRAINT "List_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailOpportunity" ADD CONSTRAINT "EmailOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskOpportunity" ADD CONSTRAINT "TaskOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaybookSection" ADD CONSTRAINT "PlaybookSection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAccount" ADD CONSTRAINT "MailboxAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TwilioAccount" ADD CONSTRAINT "TwilioAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMailboxPreference" ADD CONSTRAINT "UserMailboxPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailOpen" ADD CONSTRAINT "EmailOpen_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteOpportunity" ADD CONSTRAINT "NoteOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMailbox" ADD CONSTRAINT "CampaignMailbox_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStepRun" ADD CONSTRAINT "SequenceStepRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
