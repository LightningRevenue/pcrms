import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runStripeReconcile } from "@/lib/stripe-reconcile";

const JOB_NAME = "stripe-reconcile";
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
      await runStripeReconcile();
    },
    { connection, lockDuration: 90_000 }
  );

  console.log(`stripe-reconcile-worker started, reconciling workspace plans against Stripe once a day`);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
