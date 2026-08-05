-- AlterTable
ALTER TABLE "VerifyResult" ADD COLUMN "rowIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VerifyResult_batchId_rowIndex_key" ON "VerifyResult"("batchId", "rowIndex");
