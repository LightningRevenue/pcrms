import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runDueSequenceSteps } from "@/lib/sequence-runner";

const JOB_NAME = "sequence-step-runner";
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
      await runDueSequenceSteps();
    },
    { connection, lockDuration: 90_000 }
  );

  console.log(`sequence-worker started, checking due steps every ${REPEAT_EVERY_MS / 1000}s`);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
