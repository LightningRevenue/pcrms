import { Queue } from "bullmq";
import IORedis from "ioredis";
import { campaignQueue } from "@/lib/campaign-queue";
import { importQueue } from "@/lib/import-queue";

// Central registry of every BullMQ queue in the app, for the /admin/queues dashboard.
// gmail-reply-sync / imap-mailbox-poll / sequence-step-runner only ever had a Queue instance
// created inline inside their worker file (never exported) — reusing the same Redis
// connection here just to read job state, same as redis.ts's singleton pattern.
const globalForQueues = globalThis as unknown as { adminQueues?: Record<string, Queue> };

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = [
  "gmail-reply-sync",
  "imap-mailbox-poll",
  "sequence-step-runner",
  "campaign-send",
  "csv-import",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

const registry: Record<string, Queue> =
  globalForQueues.adminQueues ?? {
    "gmail-reply-sync": new Queue("gmail-reply-sync", { connection }),
    "imap-mailbox-poll": new Queue("imap-mailbox-poll", { connection }),
    "sequence-step-runner": new Queue("sequence-step-runner", { connection }),
    "campaign-send": campaignQueue,
    "csv-import": importQueue,
  };

if (process.env.NODE_ENV !== "production") globalForQueues.adminQueues = registry;

export function getQueue(name: QueueName): Queue {
  return registry[name];
}
