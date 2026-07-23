"use client";

import { useMemo, useState } from "react";
import type { Company, Person, Task, User } from "@prisma/client";
import { CheckSquare, AlarmClock, CalendarDays, CalendarClock } from "lucide-react";
import { TaskRow } from "@/components/task-row";
import { OwnerFilterPicker, NO_OWNER_KEY, type WorkspaceUser } from "@/components/owner-filter-picker";

type TaskWithPerson = Task & { person: Person & { company: Company | null }; createdBy: User | null };

const TABS = [
  { key: "overdue", label: "Overdue", icon: AlarmClock },
  { key: "today", label: "Today", icon: CalendarDays },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function bucket(tasks: TaskWithPerson[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const overdue: TaskWithPerson[] = [];
  const today: TaskWithPerson[] = [];
  const upcoming: TaskWithPerson[] = [];

  for (const t of tasks) {
    if (t.done) continue;
    const due = t.dueAt!;
    if (due < startOfToday) overdue.push(t);
    else if (due < startOfTomorrow) today.push(t);
    else upcoming.push(t);
  }

  return { overdue, today, upcoming };
}

export function TasksView({ tasks, users = [] }: { tasks: TaskWithPerson[]; users?: WorkspaceUser[] }) {
  const [active, setActive] = useState<TabKey>("today");
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => {
    if (ownerFilter.size === 0) return tasks;
    return tasks.filter((t) => ownerFilter.has(t.createdById ?? NO_OWNER_KEY));
  }, [tasks, ownerFilter]);

  const buckets = useMemo(() => bucket(filteredTasks), [filteredTasks]);
  const rows = buckets[active];

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5">
          <CheckSquare size={14} strokeWidth={1.75} className="text-violet-400" />
          <span className="font-medium text-[13px]">Tasks</span>
        </div>
        <OwnerFilterPicker users={users} selected={ownerFilter} onChange={setOwnerFilter} />
      </div>

      <div className="flex items-center gap-5 border-b border-border px-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`flex items-center gap-1.5 py-3 text-[13px] border-b-2 -mb-px transition-colors ${
              active === key
                ? "border-foreground font-medium"
                : "border-transparent text-subtle hover:text-foreground"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
            <span className="text-subtle">· {buckets[key].length}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {rows.length === 0 ? (
          <p className="text-[13px] text-subtle">No tasks here.</p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {rows.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
