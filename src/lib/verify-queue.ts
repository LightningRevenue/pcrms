import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { VerifyJobData } from "@/lib/run-verify";

export const VERIFY_JOB_NAME = "email-verify";

const globalForQueue = globalThis as unknown as { verifyQueue?: Queue<VerifyJobData> };

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const verifyQueue =
  globalForQueue.verifyQueue ?? new Queue<VerifyJobData>(VERIFY_JOB_NAME, { connection });

if (process.env.NODE_ENV !== "production") globalForQueue.verifyQueue = verifyQueue;
