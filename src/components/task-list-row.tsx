"use client";

import { useState } from "react";
import Link from "next/link";
import type { Opportunity, Person, Task, TaskOpportunity } from "@prisma/client";
import { Phone, Mail, CalendarClock, Users, CheckSquare, User as UserIcon, ChevronDown } from "lucide-react";
import { AssociatedDeals } from "@/components/associated-deals";
import type { TaskType, TaskPriority } from "@/components/create-task-panel";
import { useContactHref } from "@/lib/view-mode";

const TYPE_LABEL: Record<TaskType, string> = {
  call: "Call",
  event: "Event",
  email: "Email",
  meet: "Meeting",
  general: "General",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

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
  const [expanded, setExpanded] = useState(false);
  const contactHref = useContactHref();
  const Icon = TYPE_ICON[task.type as TaskType];
  const deals = task.opportunities.map((o) => o.opportunity);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
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
        </span>
        <Icon size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
        <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_COLOR[task.priority as TaskPriority]}`} />
        <p className={`flex-1 min-w-0 text-[13px] truncate ${task.done ? "line-through text-subtle" : ""}`}>
          {task.title}
        </p>
        {context === "opportunity" && task.person ? (
          <Link
            href={contactHref(task.person.id)}
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
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`text-subtle shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {task.description && <p className="text-[13px] text-subtle whitespace-pre-wrap">{task.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
            <span className="px-1.5 py-0.5 rounded-full bg-muted">{TYPE_LABEL[task.type as TaskType]}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-muted">{PRIORITY_LABEL[task.priority as TaskPriority]}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-muted">{formatDue(task.dueAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
