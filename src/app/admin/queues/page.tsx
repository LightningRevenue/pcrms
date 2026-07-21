import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { listQueueSummaries } from "@/lib/actions/admin-queues";

export default async function AdminQueuesPage() {
  await requirePlatformAdmin();
  const summaries = await listQueueSummaries();

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Admin
      </Link>

      <h1 className="text-xl font-medium mt-4">Background jobs</h1>
      <p className="text-[13px] text-subtle mt-1">BullMQ queue status, across every workspace.</p>

      <div className="mt-6 border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.2fr_80px_80px_80px_80px_80px] gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle">
          <span>Queue</span>
          <span className="text-right">Waiting</span>
          <span className="text-right">Active</span>
          <span className="text-right">Delayed</span>
          <span className="text-right text-red-500">Failed</span>
          <span className="text-right">Done</span>
        </div>
        {summaries.map(({ name, counts }) => (
          <Link
            key={name}
            href={`/admin/queues/${name}`}
            className="grid grid-cols-[1.2fr_80px_80px_80px_80px_80px] gap-3 px-3 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted transition-colors"
          >
            <span className="font-medium truncate">{name}</span>
            <span className="text-right text-subtle">{counts.waiting ?? 0}</span>
            <span className="text-right text-subtle">{counts.active ?? 0}</span>
            <span className="text-right text-subtle">{counts.delayed ?? 0}</span>
            <span className={`text-right ${counts.failed ? "text-red-500 font-medium" : "text-subtle"}`}>
              {counts.failed ?? 0}
            </span>
            <span className="text-right text-subtle">{counts.completed ?? 0}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
