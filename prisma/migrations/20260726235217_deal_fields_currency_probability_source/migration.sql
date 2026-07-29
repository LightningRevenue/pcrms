-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextStepNote" TEXT,
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "source" TEXT;
