"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Person, Task, User } from "@prisma/client";
import { ChevronDown, Pencil } from "lucide-react";
import { toggleTask, updateTask, rescheduleTask } from "@/lib/actions/tasks";
import { CreateTaskPanel, type NewTaskDraft, type TaskType, type TaskPriority } from "@/components/create-task-panel";
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

function formatTime(date: Date) {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Keeps the task's existing time-of-day, just moves the date forward — "+1 Day" on a task due
// at 3pm should land at 3pm tomorrow, not midnight.
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function TaskRow({ task }: { task: Task & { person: Person; createdBy: User | null } }) {
  const [done, setDone] = useState(task.done);
  const [dueAt, setDueAt] = useState(task.dueAt);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const contactHref = useContactHref();
  const personName = [task.person.firstName, task.person.lastName].filter(Boolean).join(" ");

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setDone((d) => !d);
    startTransition(() => toggleTask(task.id));
  }

  function handleSave(draft: NewTaskDraft) {
    startTransition(() => updateTask(task.id, draft));
  }

  function handleReschedule(e: React.MouseEvent, days: number) {
    e.stopPropagation();
    const next = addDays(dueAt ?? new Date(), days);
    setDueAt(next);
    startTransition(() => rescheduleTask(task.id, next));
  }

  const initial: NewTaskDraft = {
    title: task.title,
    description: task.description ?? "",
    type: task.type as TaskType,
    due: dueAt ? toLocalValue(dueAt) : "",
    priority: task.priority as TaskPriority,
  };

  return (
    <>
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <span
            role="button"
            onClick={handleToggle}
            className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
              done ? "bg-foreground border-foreground" : "border-border"
            }`}
            aria-label={done ? "Mark as not done" : "Mark as done"}
          >
            {done && (
              <svg viewBox="0 0 12 12" className="size-2.5 stroke-background" fill="none">
                <path d="M2 6l2.5 2.5L10 3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>

          <div className="flex-1 min-w-0">
            <p className={`text-[13px] ${done ? "line-through text-subtle" : ""}`}>{task.title}</p>
            <Link
              href={contactHref(task.personId)}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] text-subtle mt-0.5 hover:underline inline-block"
            >
              {personName || "Unknown contact"}
            </Link>
          </div>

          <span className="text-[12px] text-subtle shrink-0">{dueAt ? formatTime(dueAt) : "—"}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`text-subtle shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <div className="px-4 pb-3 pl-11 space-y-3">
            {task.description && <p className="text-[13px] text-subtle whitespace-pre-wrap">{task.description}</p>}

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
              <span className="px-1.5 py-0.5 rounded-full bg-muted">{TYPE_LABEL[task.type as TaskType]}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-muted">{PRIORITY_LABEL[task.priority as TaskPriority]}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-muted">
                {task.createdBy?.name ?? task.createdBy?.email ?? "Unknown"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleReschedule(e, 1)}
                className="px-2 py-1 rounded-md border border-border text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
              >
                +1 Day
              </button>
              <button
                onClick={(e) => handleReschedule(e, 3)}
                className="px-2 py-1 rounded-md border border-border text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
              >
                +3 Days
              </button>
              <button
                onClick={(e) => handleReschedule(e, 7)}
                className="px-2 py-1 rounded-md border border-border text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
              >
                +7 Days
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors ml-auto"
              >
                <Pencil size={12} strokeWidth={1.75} />
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <CreateTaskPanel
          relatedTo={personName || "Unknown contact"}
          initial={initial}
          onClose={() => setEditing(false)}
          onCreate={handleSave}
        />
      )}
    </>
  );
}
