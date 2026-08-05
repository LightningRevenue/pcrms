import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runVerify, type VerifyJobData } from "@/lib/run-verify";
import { VERIFY_JOB_NAME } from "@/lib/verify-queue";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function main() {
  new Worker<VerifyJobData>(
    VERIFY_JOB_NAME,
    async (job) => {
      await runVerify(job.data);
    },
    // A large CSV at 8 concurrent SMTP handshakes runs well past the 30s default lock.
    { connection, lockDuration: 30 * 60 * 1000 }
  );

  console.log("verify-worker started, waiting for jobs");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
