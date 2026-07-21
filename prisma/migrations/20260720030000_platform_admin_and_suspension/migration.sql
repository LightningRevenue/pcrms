-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "suspendedAt" TIMESTAMP(3);
