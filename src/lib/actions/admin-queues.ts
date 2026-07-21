"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { getQueue, QUEUE_NAMES, type QueueName } from "@/lib/queues";

export async function listQueueSummaries() {
  await requirePlatformAdmin();

  return Promise.all(
    QUEUE_NAMES.map(async (name) => {
      const queue = getQueue(name);
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
      return { name, counts };
    })
  );
}

export type QueueJobView = {
  id: string;
  name: string;
  data: unknown;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
};

export async function listQueueJobs(queueName: QueueName, state: "failed" | "active" | "waiting" | "completed" | "delayed") {
  await requirePlatformAdmin();

  const queue = getQueue(queueName);
  const jobs = await queue.getJobs([state], 0, 49);
  return jobs.map(
    (job): QueueJobView => ({
      id: job.id ?? "",
      name: job.name,
      data: job.data,
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn ?? null,
    })
  );
}

export async function retryQueueJob(queueName: QueueName, jobId: string) {
  await requirePlatformAdmin();

  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error("Job not found");
  await job.retry();
  revalidatePath("/admin/queues");
}

export async function removeQueueJob(queueName: QueueName, jobId: string) {
  await requirePlatformAdmin();

  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error("Job not found");
  await job.remove();
  revalidatePath("/admin/queues");
}
