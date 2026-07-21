-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "size" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN     "onboardedAt" TIMESTAMP(3);
