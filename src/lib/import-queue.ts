import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { ImportJobData } from "@/lib/run-import";

export const IMPORT_JOB_NAME = "csv-import";

const globalForQueue = globalThis as unknown as { importQueue?: Queue<ImportJobData> };

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const importQueue =
  globalForQueue.importQueue ?? new Queue<ImportJobData>(IMPORT_JOB_NAME, { connection });

if (process.env.NODE_ENV !== "production") globalForQueue.importQueue = importQueue;
