"use client";

import Link from "next/link";
import type { Opportunity, Person, Task, TaskOpportunity } from "@prisma/client";
import { Phone, Mail, CalendarClock, Users, CheckSquare, User as UserIcon } from "lucide-react";
import { AssociatedDeals } from "@/components/associated-deals";
import type { TaskType, TaskPriority } from "@/components/create-task-panel";
import { useContactHref } from "@/lib/view-mode";

const TYPE_ICON: Record<TaskType, typeof Phone> = {
  call: Phone,
  event: CalendarClock,
  email: Mail,
  meet: Users,
  general: CheckSquare,
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "bg-subtle",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

function formatDue(dueAt: Date | null) {
  if (!dueAt) return "No due date";
  return dueAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type CompanyTask = Task & { person: Person; opportunities: (TaskOpportunity & { opportunity: Opportunity })[] };

export function CompanyTasksTab({ tasks }: { tasks: CompanyTask[] }) {
  const contactHref = useContactHref();
  if (tasks.length === 0) {
    return <p className="text-[13px] text-subtle">No tasks on this company&apos;s contacts yet.</p>;
  }

  return (
    <div>
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-3">
        Tasks across contacts &amp; deals
      </p>
      <div className="border border-border rounded-lg divide-y divide-border">
        {tasks.map((task) => {
          const Icon = TYPE_ICON[task.type as TaskType];
          const deals = task.opportunities.map((o) => o.opportunity);
          const personName = [task.person.firstName, task.person.lastName].filter(Boolean).join(" ");
          return (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`size-4 shrink-0 rounded border flex items-center justify-center ${
                  task.done ? "bg-foreground border-foreground" : "border-border"
                }`}
              >
                {task.done && (
                  <svg viewBox="0 0 12 12" className="size-2.5 stroke-background" fill="none">
                    <path d="M2 6l2.5 2.5L10 3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <Icon size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
              <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_COLOR[task.priority as TaskPriority]}`} />
              <p className={`flex-1 min-w-0 text-[13px] truncate ${task.done ? "line-through text-subtle" : ""}`}>
                {task.title}
              </p>
              <Link
                href={contactHref(task.person.id)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors shrink-0"
                title={`Go to ${personName}`}
              >
                <UserIcon size={11} strokeWidth={1.75} />
                {personName}
              </Link>
              {deals.length > 0 && <AssociatedDeals opportunities={deals} />}
              <span className="text-[12px] text-subtle shrink-0">{formatDue(task.dueAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
