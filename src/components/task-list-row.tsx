import Link from "next/link";
import type { Opportunity, Person, Task, TaskOpportunity } from "@prisma/client";
import { Phone, Mail, CalendarClock, Users, CheckSquare, User as UserIcon } from "lucide-react";
import { AssociatedDeals } from "@/components/associated-deals";
import type { TaskType, TaskPriority } from "@/components/create-task-panel";

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

export type TaskWithDeals = Task & {
  person?: Person;
  opportunities: (TaskOpportunity & { opportunity: Opportunity })[];
};

export function TaskListRow({
  task,
  onToggle,
  context = "contact",
}: {
  task: TaskWithDeals;
  onToggle: () => void;
  context?: "contact" | "opportunity";
}) {
  const Icon = TYPE_ICON[task.type as TaskType];
  const deals = task.opportunities.map((o) => o.opportunity);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
          task.done ? "bg-foreground border-foreground" : "border-border"
        }`}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="size-2.5 stroke-background" fill="none">
            <path d="M2 6l2.5 2.5L10 3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <Icon size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
      <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_COLOR[task.priority as TaskPriority]}`} />
      <p className={`flex-1 min-w-0 text-[13px] truncate ${task.done ? "line-through text-subtle" : ""}`}>
        {task.title}
      </p>
      {context === "opportunity" && task.person ? (
        <Link
          href={`/contacts/${task.person.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors"
          title={`Go to ${[task.person.firstName, task.person.lastName].filter(Boolean).join(" ")}`}
        >
          <UserIcon size={11} strokeWidth={1.75} />
          {[task.person.firstName, task.person.lastName].filter(Boolean).join(" ")}
        </Link>
      ) : (
        deals.length > 0 && <AssociatedDeals opportunities={deals} />
      )}
      <span className="text-[12px] text-subtle shrink-0">{formatDue(task.dueAt)}</span>
    </div>
  );
}
