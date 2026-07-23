"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Person, Task } from "@prisma/client";
import { toggleTask, updateTask } from "@/lib/actions/tasks";
import { CreateTaskPanel, type NewTaskDraft, type TaskType, type TaskPriority } from "@/components/create-task-panel";
import { useContactHref } from "@/lib/view-mode";

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

export function TaskRow({ task }: { task: Task & { person: Person } }) {
  const [done, setDone] = useState(task.done);
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

  const initial: NewTaskDraft = {
    title: task.title,
    description: task.description ?? "",
    type: task.type as TaskType,
    due: task.dueAt ? toLocalValue(task.dueAt) : "",
    priority: task.priority as TaskPriority,
  };

  return (
    <>
      <div
        onClick={() => setEditing(true)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <button
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
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-[13px] ${done ? "line-through text-subtle" : ""}`}>{task.title}</p>
          <Link
            href={contactHref(task.personId)}
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] text-subtle mt-0.5 hover:underline"
          >
            {personName || "Unknown contact"}
          </Link>
        </div>

        <span className="text-[12px] text-subtle shrink-0">{task.dueAt ? formatTime(task.dueAt) : "—"}</span>
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
