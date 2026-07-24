-- CreateTable
CREATE TABLE "LinkedinProspect" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "linkedinUrn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "location" TEXT,
    "linkedin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedPersonId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "LinkedinProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedinProspect_workspaceId_createdAt_idx" ON "LinkedinProspect"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedinProspect_workspaceId_linkedinUrn_key" ON "LinkedinProspect"("workspaceId", "linkedinUrn");

-- AddForeignKey
ALTER TABLE "LinkedinProspect" ADD CONSTRAINT "LinkedinProspect_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
