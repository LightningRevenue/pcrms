
-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "emailDomain" TEXT;

-- Backfill: derive each existing workspace's domain from its earliest member's email
UPDATE "Workspace" w
SET "emailDomain" = sub.domain
FROM (
    SELECT DISTINCT ON (wm."workspaceId")
        wm."workspaceId",
        split_part(u.email, '@', 2) AS domain
    FROM "WorkspaceMember" wm
    JOIN "User" u ON u.id = wm."userId"
    ORDER BY wm."workspaceId", u.email ASC
) sub
WHERE w.id = sub."workspaceId" AND w."emailDomain" IS NULL;

ALTER TABLE "Workspace" ALTER COLUMN "emailDomain" SET NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "invitedById" TEXT,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_emailDomain_key" ON "Workspace"("emailDomain");

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT IF EXISTS "WorkspaceInvite_workspaceId_fkey";
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT IF EXISTS "WorkspaceInvite_invitedById_fkey";
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

