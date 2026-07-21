-- WorkspaceSetting moves from a flat key/value store (global for the whole app) to
-- workspaceId-scoped rows for keys that are genuinely per-workspace (notification_inbox).
-- Global keys (app_base_url, tracking_domain) keep workspaceId NULL.
DO $$
DECLARE
  first_workspace_id TEXT;
BEGIN
  -- The existing notification_inbox row (set before multi-tenancy existed) belongs to
  -- whichever workspace was created first — same convention used elsewhere in this migration
  -- series for attributing pre-multi-tenant state to the original workspace.
  SELECT id INTO first_workspace_id FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1;

  ALTER TABLE "WorkspaceSetting" DROP CONSTRAINT "WorkspaceSetting_pkey";
  ALTER TABLE "WorkspaceSetting" ADD COLUMN "id" TEXT;
  ALTER TABLE "WorkspaceSetting" ADD COLUMN "workspaceId" TEXT;

  UPDATE "WorkspaceSetting"
  SET id = 'ws-setting-' || key,
      "workspaceId" = CASE WHEN key = 'notification_inbox' THEN first_workspace_id ELSE NULL END
  WHERE id IS NULL;

  ALTER TABLE "WorkspaceSetting" ALTER COLUMN "id" SET NOT NULL;
  ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("id");
END $$;

CREATE UNIQUE INDEX "WorkspaceSetting_workspaceId_key_key" ON "WorkspaceSetting"("workspaceId", "key");

ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
