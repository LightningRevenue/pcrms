-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "stage" TEXT;

-- CreateTable
CREATE TABLE "ContactPipelineStage" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ContactPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactPipelineStage_workspaceId_label_key" ON "ContactPipelineStage"("workspaceId", "label");

-- AddForeignKey
ALTER TABLE "ContactPipelineStage" ADD CONSTRAINT "ContactPipelineStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
