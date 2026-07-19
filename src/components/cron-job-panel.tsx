"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CronJobRun } from "@prisma/client";
import { Play, CheckCircle2, XCircle, Loader2 } from "lucide-react";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function durationLabel(run: CronJobRun) {
  if (!run.finishedAt) return "—";
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export function CronJobPanel({
  title,
  description,
  countLabel = "Emails found",
  runs,
  onRunNow,
}: {
  title: string;
  description: string;
  countLabel?: string;
  runs: CronJobRun[];
  onRunNow: () => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(interval);
  }, [router]);

  const latest = runs[0];
  const isRunning = latest?.status === "running";

  function handleRunNow() {
    startTransition(async () => {
      await onRunNow();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="border border-border rounded-md p-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium">{title}</p>
          <p className="text-[12px] text-subtle mt-1">{description}</p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={isPending || isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isPending || isRunning ? (
            <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
          ) : (
            <Play size={14} strokeWidth={1.75} />
          )}
          Run now
        </button>
      </div>

      <h2 className="text-[13px] font-semibold mt-6 mb-2">Run history</h2>
      {runs.length === 0 ? (
        <p className="text-[13px] text-subtle">No runs yet. Click &ldquo;Run now&rdquo; to trigger one.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] text-subtle border-b border-border">
              <th className="font-normal pb-2">Status</th>
              <th className="font-normal pb-2">Started</th>
              <th className="font-normal pb-2">Duration</th>
              <th className="font-normal pb-2">{countLabel}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-border">
                <td className="py-2.5">
                  {run.status === "success" && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-400">
                      <CheckCircle2 size={13} strokeWidth={1.75} />
                      Success
                    </span>
                  )}
                  {run.status === "error" && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] text-red-400"
                      title={run.error ?? undefined}
                    >
                      <XCircle size={13} strokeWidth={1.75} />
                      Error
                    </span>
                  )}
                  {run.status === "running" && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
                      <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
                      Running
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-[13px]">{formatDate(run.startedAt)}</td>
                <td className="py-2.5 text-[13px] text-subtle">{durationLabel(run)}</td>
                <td className="py-2.5 text-[13px] text-subtle">{run.emailsFound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
