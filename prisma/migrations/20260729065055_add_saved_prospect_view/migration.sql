-- CreateTable
CREATE TABLE "SavedProspectView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "SavedProspectView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedProspectView_workspaceId_createdById_idx" ON "SavedProspectView"("workspaceId", "createdById");

-- AddForeignKey
ALTER TABLE "SavedProspectView" ADD CONSTRAINT "SavedProspectView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProspectView" ADD CONSTRAINT "SavedProspectView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
