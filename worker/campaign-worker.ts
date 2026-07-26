import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runDueCampaignSteps } from "@/lib/campaign-runner";
import { runDueScheduledEmails } from "@/lib/scheduled-email-runner";

const JOB_NAME = "campaign-step-runner";
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
      // Two independent drains on the same 60s tick. "Send later" emails share this schedule
      // rather than getting their own worker — same cadence, same Redis, nothing gained by a
      // second process. Wrapped so a failure in one drain still lets the other run.
      const results = await Promise.allSettled([runDueCampaignSteps(), runDueScheduledEmails()]);
      for (const r of results) {
        if (r.status === "rejected") console.error("drain failed:", r.reason);
      }
    },
    { connection, lockDuration: 90_000 }
  );

  console.log(`campaign-worker started, checking due steps every ${REPEAT_EVERY_MS / 1000}s`);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
