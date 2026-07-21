"use client";

import { useState, useTransition } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { retryQueueJob, removeQueueJob, type QueueJobView } from "@/lib/actions/admin-queues";
import type { QueueName } from "@/lib/queues";

export function QueueJobList({
  queueName,
  jobs,
  canRetryOrRemove,
}: {
  queueName: QueueName;
  jobs: QueueJobView[];
  canRetryOrRemove: boolean;
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function handleRetry(jobId: string) {
    startTransition(async () => {
      await retryQueueJob(queueName, jobId);
      setRemovedIds((prev) => new Set(prev).add(jobId));
    });
  }

  function handleRemove(jobId: string) {
    if (!confirm("Remove this job permanently?")) return;
    startTransition(async () => {
      await removeQueueJob(queueName, jobId);
      setRemovedIds((prev) => new Set(prev).add(jobId));
    });
  }

  const visibleJobs = jobs.filter((j) => !removedIds.has(j.id));

  return (
    <div className="mt-4 border border-border rounded-md overflow-hidden">
      {visibleJobs.map((job) => (
        <div key={job.id} className="px-3 py-3 text-[13px] border-b border-border last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-medium">{job.name}</span>
              <span className="text-subtle ml-2">#{job.id}</span>
            </div>
            {canRetryOrRemove && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRetry(job.id)}
                  disabled={isPending}
                  title="Retry"
                  className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCw size={14} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleRemove(job.id)}
                  disabled={isPending}
                  title="Remove"
                  className="p-1.5 rounded-md text-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>
          {job.failedReason && (
            <p className="text-[12px] text-red-500 mt-1.5 break-words">{job.failedReason}</p>
          )}
          <p className="text-[11px] text-subtle mt-1">
            {job.attemptsMade} attempt{job.attemptsMade === 1 ? "" : "s"} · {new Date(job.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
      {visibleJobs.length === 0 && (
        <div className="px-3 py-4 text-[13px] text-subtle text-center">No jobs in this state</div>
      )}
    </div>
  );
}
