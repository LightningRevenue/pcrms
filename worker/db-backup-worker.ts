import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runDatabaseBackup } from "@/lib/db-backup";

const JOB_NAME = "db-backup";
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const queue = new Queue(JOB_NAME, { connection });

async function main() {
  await queue.upsertJobScheduler(JOB_NAME, { every: REPEAT_EVERY_MS }, { name: JOB_NAME });

  new Worker(
    JOB_NAME,
    async () => {
      await runDatabaseBackup();
    },
    { connection, lockDuration: 5 * 60_000 }
  );

  console.log(`db-backup-worker started, backing up Postgres once a day`);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
