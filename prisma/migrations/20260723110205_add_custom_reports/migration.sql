-- CreateTable
CREATE TABLE "CustomReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT,
    "aggregate" TEXT NOT NULL DEFAULT 'count',
    "display" TEXT NOT NULL DEFAULT 'table',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CustomReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomReport_workspaceId_idx" ON "CustomReport"("workspaceId");

-- AddForeignKey
ALTER TABLE "CustomReport" ADD CONSTRAINT "CustomReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomReport" ADD CONSTRAINT "CustomReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
