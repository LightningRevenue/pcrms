"use client";

import { useState, useTransition } from "react";
import type { Opportunity } from "@prisma/client";
import { Plus } from "lucide-react";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { TaskListRow, type TaskWithDeals } from "@/components/task-list-row";
import { createTask, toggleTask } from "@/lib/actions/tasks";

export function ContactTasksTab({
  personId,
  contactName,
  tasks,
  opportunities = [],
}: {
  personId: string;
  contactName: string;
  tasks: TaskWithDeals[];
  opportunities?: Opportunity[];
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    startTransition(() => toggleTask(id));
  }

  function addTask(draft: NewTaskDraft) {
    setError(null);
    startTransition(async () => {
      try {
        await createTask({
          personId,
          title: draft.title,
          description: draft.description,
          type: draft.type,
          due: draft.due,
          priority: draft.priority,
          opportunityIds: draft.opportunityIds,
        });
        setCreating(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Tasks</p>
        <button
          onClick={() => setCreating(true)}
          disabled={pending}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.75} />
          New task
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mb-2">{error}</p>}

      {tasks.length === 0 ? (
        <p className="text-[13px] text-subtle">No tasks yet.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {tasks.map((t) => (
            <TaskListRow key={t.id} task={t} onToggle={() => toggle(t.id)} />
          ))}
        </div>
      )}

      {creating && (
        <CreateTaskPanel
          relatedTo={contactName}
          opportunities={opportunities}
          onClose={() => setCreating(false)}
          onCreate={addTask}
        />
      )}
    </div>
  );
}
