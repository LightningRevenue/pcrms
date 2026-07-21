import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { listQueueJobs } from "@/lib/actions/admin-queues";
import { QUEUE_NAMES, type QueueName } from "@/lib/queues";
import { QueueJobList } from "@/components/queue-job-list";

const STATES = ["failed", "active", "waiting", "delayed", "completed"] as const;

export default async function AdminQueueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ queueName: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  await requirePlatformAdmin();
  const { queueName } = await params;
  if (!QUEUE_NAMES.includes(queueName as QueueName)) notFound();

  const { state: rawState } = await searchParams;
  const state = (STATES as readonly string[]).includes(rawState ?? "") ? (rawState as (typeof STATES)[number]) : "failed";

  const jobs = await listQueueJobs(queueName as QueueName, state);

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/admin/queues" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Queues
      </Link>

      <h1 className="text-xl font-medium mt-4">{queueName}</h1>

      <div className="flex items-center gap-1 mt-4 border-b border-border">
        {STATES.map((s) => (
          <Link
            key={s}
            href={`/admin/queues/${queueName}?state=${s}`}
            className={`px-3 py-2 text-[13px] capitalize border-b-2 -mb-px transition-colors ${
              s === state ? "border-accent text-foreground font-medium" : "border-transparent text-subtle hover:text-foreground"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <QueueJobList queueName={queueName as QueueName} jobs={jobs} canRetryOrRemove={state === "failed"} />
    </div>
  );
}
