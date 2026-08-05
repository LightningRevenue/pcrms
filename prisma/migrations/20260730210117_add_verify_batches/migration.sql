-- CreateTable
CREATE TABLE "VerifyBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailColumn" TEXT NOT NULL,
    "sourceCsv" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "checkedRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "catchAllRows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "VerifyBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifyResult" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "row" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "VerifyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerifyBatch_createdById_idx" ON "VerifyBatch"("createdById");

-- CreateIndex
CREATE INDEX "VerifyResult_batchId_status_idx" ON "VerifyResult"("batchId", "status");

-- AddForeignKey
ALTER TABLE "VerifyBatch" ADD CONSTRAINT "VerifyBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifyResult" ADD CONSTRAINT "VerifyResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VerifyBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
