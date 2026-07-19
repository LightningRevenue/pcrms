import Link from "next/link";
import { TaskRow } from "@/components/task-row";
import { TrendChart } from "@/components/trend-chart";
import { listTasksDueToday } from "@/lib/actions/tasks";
import { getDashboardStats, getNewLeadsTrend, getRecentActivity } from "@/lib/actions/dashboard";
import { ActivityIcon } from "@/components/activity-icon";

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCurrency(value: number) {
  return `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`;
}

export default async function Home() {
  const [stats, tasks, trend, activity] = await Promise.all([
    getDashboardStats(),
    listTasksDueToday(),
    getNewLeadsTrend(),
    getRecentActivity(8),
  ]);

  const statTiles = [
    { label: "New leads today", value: stats.newLeadsToday },
    { label: "Contacted today", value: stats.contactedToday },
    { label: "Deals won this week", value: stats.dealsWonThisWeek },
    { label: "Open pipeline value", value: formatCurrency(stats.pipelineOpenValue) },
  ];

  return (
    <div className="px-8 py-10">
      <h1 className="text-xl font-medium mb-8">Home</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {statTiles.map((s) => (
          <div key={s.label} className="border border-border rounded-lg px-4 py-3">
            <div className="text-2xl font-medium tabular-nums">{s.value}</div>
            <div className="text-[13px] text-subtle mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-lg px-4 py-3 mb-10">
        <TrendChart data={trend} label="New leads, last 7 days" />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-8">
        <section>
          <h2 className="text-[13px] font-medium text-subtle uppercase tracking-wide mb-3">
            Today&apos;s tasks
          </h2>
          {tasks.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg px-4 py-6 text-center">
              <p className="text-[13px] text-subtle">No tasks due today.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-medium text-subtle uppercase tracking-wide mb-3">
            Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="text-[13px] text-subtle">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => {
                const actor = a.actor?.name ?? a.actor?.email ?? "Someone";
                return (
                  <Link key={a.id} href={a.href} className="flex items-start gap-2.5 group">
                    <ActivityIcon kind={a.kind} />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug group-hover:underline">
                        <span className="font-medium">{a.entityName}</span> —{" "}
                        {a.kind === "created" && "created"}
                        {a.kind === "opportunity_created" && `opportunity ${a.newValue}`}
                        {a.kind === "stage_changed" && `moved to ${a.newValue}`}
                        {a.kind === "task_created" && `task added: ${a.newValue}`}
                        {a.kind === "task_completed" && `task completed: ${a.newValue}`}
                        {a.kind === "email_sent" && `email sent: ${a.newValue}`}
                        {a.kind === "note_added" && "note added"}
                        {a.kind === "person_removed" && "removed"}
                        {a.kind === "company_removed" && "removed"}
                        {a.kind === "field_update" && `${a.field} updated`}
                        {" by "}
                        {actor}
                      </p>
                      <p className="text-subtle mt-0.5 text-[12px]">{relativeTime(a.createdAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
