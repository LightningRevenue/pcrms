import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runCampaignSendJob } from "@/lib/campaign-runner";
import { CAMPAIGN_JOB_NAME, type CampaignSendJobData } from "@/lib/campaign-queue";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function main() {
  new Worker<CampaignSendJobData>(
    CAMPAIGN_JOB_NAME,
    async (job) => {
      await runCampaignSendJob(job.data);
    },
    { connection, lockDuration: 60_000 }
  );

  console.log("campaign-worker started, waiting for paced send jobs");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
