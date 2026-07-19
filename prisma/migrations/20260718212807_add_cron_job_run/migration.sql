-- CreateTable
CREATE TABLE "CronJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "emailsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "CronJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJobRun_job_startedAt_idx" ON "CronJobRun"("job", "startedAt");
