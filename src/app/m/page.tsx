import Link from "next/link";
import { auth } from "@/lib/auth";
import { KanbanSquare, CheckSquare, Inbox } from "lucide-react";
import { listOpportunities } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listTasksDueToday } from "@/lib/actions/tasks";
import { listInboxThreads } from "@/lib/actions/inbox";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function MobileHomePage() {
  const [session, opportunities, stages, tasksToday, { threads }] = await Promise.all([
    auth(),
    listOpportunities(),
    listPipelineStages(),
    listTasksDueToday(),
    listInboxThreads(),
  ]);

  const openStageLabels = new Set(stages.filter((s) => s.outcome === "open").map((s) => s.label));
  const openDealsCount = opportunities.filter((o) => openStageLabels.has(o.stage)).length;
  const tasksDueTodayCount = tasksToday.filter((t) => !t.done).length;
  const awaitingReplyCount = threads.filter((t) => {
    const last = t.messages[t.messages.length - 1];
    return last?.direction === "received";
  }).length;

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold">
          {greeting()}, {firstName}
        </h1>
        <p className="text-[13px] text-subtle">Here&apos;s where things stand today.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard href="/m/deals" icon={KanbanSquare} label="Open deals" value={openDealsCount} />
        <StatCard href="/m/tasks" icon={CheckSquare} label="Due today" value={tasksDueTodayCount} />
        <StatCard href="/m/inbox" icon={Inbox} label="Awaiting reply" value={awaitingReplyCount} />
      </div>

      <a href="/api/mobile-view?view=desktop" className="block text-center text-[12px] text-subtle underline">
        Continue to desktop site
      </a>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: typeof Inbox;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 active:bg-muted transition-colors"
    >
      <Icon size={16} strokeWidth={1.75} className="text-accent" />
      <span className="text-2xl font-bold leading-none">{value}</span>
      <span className="text-[11px] text-subtle leading-tight">{label}</span>
    </Link>
  );
}
