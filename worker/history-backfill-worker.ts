import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runHistoryBackfill, type HistoryBackfillJobData } from "@/lib/run-history-backfill";
import { HISTORY_BACKFILL_JOB_NAME } from "@/lib/history-backfill-queue";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function main() {
  new Worker<HistoryBackfillJobData>(
    HISTORY_BACKFILL_JOB_NAME,
    async (job) => {
      await runHistoryBackfill(job.data);
    },
    // An unindexed IMAP search across every mailbox plus Gmail paging runs well past the 30s
    // default lock. Concurrency 2 keeps a burst of new contacts (CSV import) from opening a
    // connection storm against the same IMAP provider.
    { connection, lockDuration: 10 * 60 * 1000, concurrency: 2 }
  );

  console.log("history-backfill-worker started, waiting for jobs");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
