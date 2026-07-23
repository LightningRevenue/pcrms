"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Mail, Phone, Building2, ArrowRight, Plus } from "lucide-react";
import type { Task, Person, Company } from "@prisma/client";
import { createTask, rescheduleTask, type TaskType } from "@/lib/actions/tasks";
import { ContactPicker } from "@/components/contact-picker";
import { useContactHref } from "@/lib/view-mode";

type TaskWithPerson = Task & { person: Person & { company: Company | null } };

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meet", label: "Meeting" },
  { value: "event", label: "Event" },
  { value: "general", label: "General" },
];

const TYPE_COLOR: Record<string, string> = {
  call: "bg-emerald-500 text-white border-emerald-500",
  email: "bg-blue-500 text-white border-blue-500",
  meet: "bg-violet-500 text-white border-violet-500",
  event: "bg-amber-500 text-white border-amber-500",
  general: "bg-muted text-foreground border-border",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00 - 18:00

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date) {
  const offset = (d.getDay() + 6) % 7; // Monday-first
  const s = new Date(d);
  s.setDate(d.getDate() - offset);
  s.setHours(0, 0, 0, 0);
  return s;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function buildMonthGrid(monthCursor: Date) {
  const first = startOfMonth(monthCursor);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function personName(person: Person) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function CalendarView({ tasks }: { tasks: TaskWithPerson[] }) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<TaskWithPerson | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);
  const [, startTransition] = useTransition();
  const today = new Date();

  const [dated, setDated] = useState(() =>
    tasks.filter((t) => t.dueAt).map((t) => ({ ...t, dueAt: new Date(t.dueAt as unknown as string) }))
  );
  useEffect(() => {
    setDated(tasks.filter((t) => t.dueAt).map((t) => ({ ...t, dueAt: new Date(t.dueAt as unknown as string) })));
  }, [tasks]);

  function tasksOn(day: Date) {
    return dated.filter((t) => sameDay(t.dueAt, day)).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  function handleReschedule(taskId: string, newDueAt: Date) {
    setDated((prev) => prev.map((t) => (t.id === taskId ? { ...t, dueAt: newDueAt } : t)));
    startTransition(async () => {
      await rescheduleTask(taskId, newDueAt);
      router.refresh();
    });
  }

  function handleCreated() {
    setCreatingAt(null);
    router.refresh();
  }

  function shift(dir: 1 | -1) {
    setCursor((c) => {
      if (view === "month") return new Date(c.getFullYear(), c.getMonth() + dir, 1);
      if (view === "week") return addDays(c, dir * 7);
      return addDays(c, dir);
    });
  }

  const title =
    view === "month"
      ? cursor.toLocaleString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? (() => {
            const s = startOfWeek(cursor);
            const e = addDays(s, 6);
            const sameMonth = s.getMonth() === e.getMonth();
            return sameMonth
              ? `${s.toLocaleString(undefined, { month: "long" })} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
              : `${s.toLocaleString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
          })()
        : cursor.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Calendar</h1>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => shift(-1)}
              className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => shift(1)}
              className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight size={15} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="ml-1 px-2.5 py-1 rounded-md border border-border text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              Today
            </button>
          </div>
          <span className="text-[13px] text-subtle">{title}</span>
        </div>

        <div className="flex items-center rounded-md border border-border p-0.5">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded text-[12px] capitalize transition-colors ${
                view === v ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === "month" && <MonthView cursor={cursor} today={today} tasksOn={tasksOn} onSelect={setSelected} />}
        {view === "week" && <WeekView cursor={cursor} today={today} tasksOn={tasksOn} onSelect={setSelected} />}
        {view === "day" && (
          <DayView
            cursor={cursor}
            tasksOn={tasksOn}
            onSelect={setSelected}
            onReschedule={handleReschedule}
            onCreateAt={setCreatingAt}
          />
        )}
      </div>

      {selected && <TaskModal task={selected} onClose={() => setSelected(null)} />}
      {creatingAt && <CreateTaskPopover at={creatingAt} onClose={() => setCreatingAt(null)} onCreated={handleCreated} />}
    </div>
  );
}

function TaskPill({ task, onSelect }: { task: TaskWithPerson & { dueAt: Date }; onSelect: (t: TaskWithPerson) => void }) {
  return (
    <button
      onClick={() => onSelect(task)}
      className={`w-full text-left px-1.5 py-0.5 rounded border text-[11px] truncate hover:opacity-80 transition-opacity ${TYPE_COLOR[task.type] ?? TYPE_COLOR.general}`}
      title={`${task.title} — ${personName(task.person)}`}
    >
      <span className="font-medium">{task.dueAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>{" "}
      {task.title}
    </button>
  );
}

function MonthView({
  cursor,
  today,
  tasksOn,
  onSelect,
}: {
  cursor: Date;
  today: Date;
  tasksOn: (day: Date) => (TaskWithPerson & { dueAt: Date })[];
  onSelect: (t: TaskWithPerson) => void;
}) {
  const grid = buildMonthGrid(cursor);
  return (
    <div className="grid grid-cols-7 h-full">
      {WEEKDAYS.map((w) => (
        <div key={w} className="px-2 py-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide border-b border-border">
          {w}
        </div>
      ))}
      {grid.map((day) => {
        const inMonth = day.getMonth() === cursor.getMonth();
        const isToday = sameDay(day, today);
        const dayTasks = tasksOn(day);
        return (
          <div key={day.toISOString()} className="min-h-[100px] border-b border-r border-border px-1.5 py-1.5 space-y-1">
            <span
              className={`inline-flex size-5 items-center justify-center rounded-md text-[12px] ${
                isToday ? "bg-accent text-white font-medium" : inMonth ? "text-foreground" : "text-subtle/40"
              }`}
            >
              {day.getDate()}
            </span>
            <div className="space-y-0.5">
              {dayTasks.slice(0, 3).map((t) => (
                <TaskPill key={t.id} task={t} onSelect={onSelect} />
              ))}
              {dayTasks.length > 3 && <div className="text-[11px] text-subtle px-1.5">+{dayTasks.length - 3} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  cursor,
  today,
  tasksOn,
  onSelect,
}: {
  cursor: Date;
  today: Date;
  tasksOn: (day: Date) => (TaskWithPerson & { dueAt: Date })[];
  onSelect: (t: TaskWithPerson) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-[56px_1fr] h-full">
      <div className="border-r border-border">
        <div className="h-10 border-b border-border" />
        {HOURS.map((h) => (
          <div key={h} className="h-14 px-2 text-[11px] text-subtle -translate-y-2">
            {h}:00
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isToday = sameDay(day, today);
          const dayTasks = tasksOn(day);
          return (
            <div key={day.toISOString()} className="border-r border-border last:border-r-0">
              <div className="h-10 flex flex-col items-center justify-center border-b border-border">
                <span className="text-[11px] text-subtle uppercase">{day.toLocaleString(undefined, { weekday: "short" })}</span>
                <span className={`text-[12px] ${isToday ? "text-accent font-medium" : "text-foreground"}`}>{day.getDate()}</span>
              </div>
              <div className="relative" style={{ height: HOURS.length * 56 }}>
                {HOURS.map((h) => (
                  <div key={h} className="h-14 border-b border-border/50" />
                ))}
                {dayTasks.map((t) => {
                  const startHour = t.dueAt.getHours() + t.dueAt.getMinutes() / 60;
                  const top = (startHour - HOURS[0]) * 56;
                  if (top < 0) return null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t)}
                      style={{ top, height: 30 }}
                      className={`absolute left-1 right-1 text-left rounded border px-1.5 py-0.5 text-[11px] overflow-hidden hover:opacity-80 transition-opacity ${TYPE_COLOR[t.type] ?? TYPE_COLOR.general}`}
                      title={`${t.title} — ${personName(t.person)}`}
                    >
                      <span className="font-medium">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const SNAP_PX = (HOUR_HEIGHT * SNAP_MINUTES) / 60;

function snapY(offsetY: number) {
  return Math.round(offsetY / SNAP_PX) * SNAP_PX;
}

function timeAtOffset(cursor: Date, offsetY: number) {
  const snappedMinutes = Math.round((HOURS[0] * 60 + (offsetY / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
  const d = new Date(cursor);
  d.setHours(0, snappedMinutes, 0, 0);
  return d;
}

function DayView({
  cursor,
  tasksOn,
  onSelect,
  onReschedule,
  onCreateAt,
}: {
  cursor: Date;
  tasksOn: (day: Date) => (TaskWithPerson & { dueAt: Date })[];
  onSelect: (t: TaskWithPerson) => void;
  onReschedule: (taskId: string, newDueAt: Date) => void;
  onCreateAt: (at: Date) => void;
}) {
  const dayTasks = tasksOn(cursor);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOverY, setDragOverY] = useState<number | null>(null);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    onCreateAt(timeAtOffset(cursor, offsetY));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOverY(null);
    const taskId = e.dataTransfer.getData("text/task-id");
    if (!taskId || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    onReschedule(taskId, timeAtOffset(cursor, offsetY));
  }

  return (
    <div className="grid grid-cols-[56px_1fr] max-w-2xl">
      <div className="border-r border-border">
        {HOURS.map((h) => (
          <div key={h} className="h-16 px-2 text-[11px] text-subtle -translate-y-2">
            {h}:00
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        onClick={handleGridClick}
        onDragOver={(e) => {
          e.preventDefault();
          if (gridRef.current) setDragOverY(e.clientY - gridRef.current.getBoundingClientRect().top);
        }}
        onDragLeave={() => setDragOverY(null)}
        onDrop={handleDrop}
        className="relative cursor-pointer"
        style={{ height: HOURS.length * HOUR_HEIGHT }}
        title="Click an empty slot to add a task"
      >
        {HOURS.map((h) => (
          <div key={h} className="h-16 border-b border-border/50" />
        ))}
        {dragOverY !== null && (
          <div className="absolute left-1 right-2 h-0.5 bg-accent pointer-events-none" style={{ top: snapY(dragOverY) }} />
        )}
        {dayTasks.map((t) => {
          const startHour = t.dueAt.getHours() + t.dueAt.getMinutes() / 60;
          const top = (startHour - HOURS[0]) * HOUR_HEIGHT;
          if (top < 0) return null;
          return (
            <button
              key={t.id}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData("text/task-id", t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(t);
              }}
              style={{ top, height: 44 }}
              className={`absolute left-1 right-2 text-left rounded-md border px-2 py-1 text-[12px] overflow-hidden hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing ${TYPE_COLOR[t.type] ?? TYPE_COLOR.general}`}
            >
              <p className="font-medium truncate">{t.title}</p>
              <p className="text-[11px] opacity-80 truncate">{personName(t.person)}</p>
            </button>
          );
        })}
        {dayTasks.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-[13px] text-subtle pointer-events-none">
            No tasks today — click a slot to add one
          </p>
        )}
      </div>
    </div>
  );
}

function TaskModal({ task, onClose }: { task: TaskWithPerson; onClose: () => void }) {
  const person = task.person;
  const name = personName(person);
  const contactHref = useContactHref();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-80 border border-border rounded-lg bg-surface shadow-xl shadow-black/40 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] mb-2 ${TYPE_COLOR[task.type] ?? TYPE_COLOR.general}`}>
              {task.type}
            </span>
            <p className="text-[14px] font-medium leading-tight truncate">{task.title}</p>
            {task.dueAt && (
              <p className="text-[12px] text-subtle mt-0.5">
                {new Date(task.dueAt).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {task.description && <p className="mt-3 text-[13px] text-subtle">{task.description}</p>}

        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2.5">
          <div className="size-9 shrink-0 rounded-full bg-muted border border-border flex items-center justify-center text-[12px] font-medium text-subtle">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-tight truncate">{name}</p>
            {person.company && (
              <span className="flex items-center gap-1.5 text-[12px] text-subtle mt-0.5 truncate">
                <Building2 size={12} strokeWidth={1.75} className="shrink-0" />
                {person.company.name}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1.5 text-[12px] text-subtle">
          {person.email && (
            <div className="flex items-center gap-2 truncate">
              <Mail size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{person.email}</span>
            </div>
          )}
          {person.phone && (
            <div className="flex items-center gap-2 truncate">
              <Phone size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{person.phone}</span>
            </div>
          )}
        </div>

        <Link
          href={contactHref(person.id)}
          className="mt-4 flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Go to contact
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

function CreateTaskPopover({
  at,
  onClose,
  onCreated,
}: {
  at: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("call");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dueLocal = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
  })();
  const [due, setDue] = useState(dueLocal);

  function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!contactId) {
      setError("Pick a contact for this task");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createTask({ personId: contactId, title, type, due, priority: "medium" });
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-80 border border-border rounded-lg bg-surface shadow-xl shadow-black/40 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            <Plus size={15} strokeWidth={1.75} />
            New task
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent transition-colors"
        />

        <div className="flex items-center gap-2 mt-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className="px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none cursor-pointer"
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-background text-foreground">
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="mt-2 border border-border rounded-md">
          <ContactPicker
            contactId={contactId}
            contactName={contactName}
            onPick={(id, name) => {
              setContactId(id);
              setContactName(name);
            }}
            onClear={() => {
              setContactId(null);
              setContactName("");
            }}
          />
        </div>

        {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
