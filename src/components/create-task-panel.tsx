"use client";

import { useState } from "react";
import type { Opportunity } from "@prisma/client";
import { Minus, X, Phone, Mail, CalendarClock, Users, CheckSquare } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { OpportunityMultiSelect } from "@/components/opportunity-multi-select";

export type TaskType = "call" | "email" | "event" | "meet" | "general";
export type TaskPriority = "low" | "medium" | "high";

export type NewTaskDraft = {
  title: string;
  description: string;
  type: TaskType;
  due: string;
  priority: TaskPriority;
  opportunityIds?: string[];
};

const TYPES: { key: TaskType; label: string; icon: typeof Phone }[] = [
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "event", label: "Event", icon: CalendarClock },
  { key: "meet", label: "Meet", icon: Users },
  { key: "general", label: "General", icon: CheckSquare },
];

const PRIORITIES: { key: TaskPriority; label: string; color: string }[] = [
  { key: "low", label: "Low", color: "text-subtle" },
  { key: "medium", label: "Medium", color: "text-amber-400" },
  { key: "high", label: "High", color: "text-rose-400" },
];

export function CreateTaskPanel({
  relatedTo,
  initial,
  opportunities = [],
  onClose,
  onCreate,
}: {
  relatedTo: string;
  initial?: NewTaskDraft;
  opportunities?: Opportunity[];
  onClose: () => void;
  onCreate: (task: NewTaskDraft) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<TaskType>(initial?.type ?? "general");
  const [due, setDue] = useState(initial?.due ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [opportunityIds, setOpportunityIds] = useState<string[]>(initial?.opportunityIds ?? []);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) {
      setError("Add a title");
      return;
    }
    onCreate({ title: title.trim(), description, type, due, priority, opportunityIds });
    onClose();
  }

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 w-[440px] bg-background border border-border border-b-0 rounded-t-lg shadow-2xl flex flex-col ${
        minimized ? "" : "h-[520px]"
      }`}
    >
      <div
        className="h-11 shrink-0 flex items-center justify-between px-4 bg-muted rounded-t-lg cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-[13px] font-medium truncate">{title.trim() ? title : "New task"}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            {TYPES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setType(key)}
                title={label}
                className={`p-1.5 rounded-md border transition-colors ${
                  type === key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-transparent text-subtle hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={15} strokeWidth={1.75} />
              </button>
            ))}
          </div>

          <div className="px-4 py-2.5 border-b border-border">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full text-[13px] font-medium outline-none bg-transparent placeholder:text-subtle placeholder:font-normal"
            />
          </div>

          <div className="px-4 py-3 flex-1 min-h-0">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="w-full h-full resize-none text-[13px] outline-none bg-transparent placeholder:text-subtle"
            />
          </div>

          <div className="px-4 py-2.5 border-t border-border grid grid-cols-2 gap-x-3 gap-y-2">
            <label className="flex items-center gap-2">
              <span className="text-[12px] text-subtle w-14 shrink-0">Due</span>
              <DatePicker value={due} onChange={setDue} />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[12px] text-subtle w-14 shrink-0">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="flex-1 min-w-0 text-[13px] outline-none bg-transparent"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key} className="bg-background text-foreground">
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 col-span-2">
              <span className="text-[12px] text-subtle w-14 shrink-0">Related</span>
              <span className="flex-1 min-w-0 text-[13px] truncate">{relatedTo}</span>
            </label>
            {opportunities.length > 0 && (
              <div className="col-span-2">
                <OpportunityMultiSelect
                  opportunities={opportunities}
                  selectedIds={opportunityIds}
                  onChange={setOpportunityIds}
                />
              </div>
            )}
          </div>

          {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

          <div className="px-4 py-3 border-t border-border flex items-center justify-end shrink-0">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              {initial ? "Save task" : "Create task"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
