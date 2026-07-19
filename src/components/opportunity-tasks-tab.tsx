"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { TaskListRow, type TaskWithDeals } from "@/components/task-list-row";
import { createTask, toggleTask } from "@/lib/actions/tasks";

export function OpportunityTasksTab({
  personId,
  contactName,
  opportunityId,
  tasks,
}: {
  personId: string | null;
  contactName: string;
  opportunityId: string;
  tasks: TaskWithDeals[];
}) {
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    startTransition(() => toggleTask(id));
  }

  function addTask(draft: NewTaskDraft) {
    if (!personId) return;
    startTransition(() =>
      createTask({
        personId,
        title: draft.title,
        description: draft.description,
        type: draft.type,
        due: draft.due,
        priority: draft.priority,
        opportunityIds: [opportunityId],
      })
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Tasks</p>
        <button
          onClick={() => setCreating(true)}
          disabled={pending || !personId}
          title={personId ? undefined : "No point of contact on this deal"}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={1.75} />
          New task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-[13px] text-subtle">No tasks linked to this deal yet.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {tasks.map((t) => (
            <TaskListRow key={t.id} task={t} onToggle={() => toggle(t.id)} context="opportunity" />
          ))}
        </div>
      )}

      {creating && personId && (
        <CreateTaskPanel relatedTo={contactName} onClose={() => setCreating(false)} onCreate={addTask} />
      )}
    </div>
  );
}
