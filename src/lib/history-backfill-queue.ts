import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { HistoryBackfillJobData } from "@/lib/run-history-backfill";

export const HISTORY_BACKFILL_JOB_NAME = "history-backfill";

const globalForQueue = globalThis as unknown as { historyBackfillQueue?: Queue<HistoryBackfillJobData> };

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const historyBackfillQueue =
  globalForQueue.historyBackfillQueue ??
  new Queue<HistoryBackfillJobData>(HISTORY_BACKFILL_JOB_NAME, { connection });

if (process.env.NODE_ENV !== "production") globalForQueue.historyBackfillQueue = historyBackfillQueue;
