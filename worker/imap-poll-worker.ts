import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runImapPollAll } from "@/lib/imap-sync";

const JOB_NAME = "imap-mailbox-poll";
const REPEAT_EVERY_MS = 60 * 1000;

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const queue = new Queue(JOB_NAME, { connection });

async function main() {
  await queue.upsertJobScheduler(JOB_NAME, { every: REPEAT_EVERY_MS }, { name: JOB_NAME });

  new Worker(
    JOB_NAME,
    async () => {
      await runImapPollAll();
    },
    { connection, lockDuration: 90_000 }
  );

  console.log(`imap-poll-worker started, polling every ${REPEAT_EVERY_MS / 1000}s`);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
