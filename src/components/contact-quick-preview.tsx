"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  X,
  Mail,
  Phone,
  Building2,
  Link2,
  ArrowUpRight,
  History,
  CalendarClock,
  CalendarDays,
  UserCircle,
  CheckSquare,
  StickyNote,
  Circle,
  CheckCircle2,
} from "lucide-react";
import type { Activity, Task } from "@prisma/client";
import type { NoteWithAuthor, PersonRow } from "@/components/contacts-view";
import { CompanyLogo } from "@/components/company-logo";
import { setPersonOwner } from "@/lib/actions/contacts";
import { toggleTask } from "@/lib/actions/tasks";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

function fullName(p: Pick<PersonRow, "firstName" | "lastName">) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDue(date: Date) {
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isDueTodayOrLater(dueAt: Date | null) {
  if (!dueAt) return true; // no due date — still show it, sorted last
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueAt.getTime() >= startOfToday.getTime();
}

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-subtle uppercase tracking-wide">
        <Icon size={12} strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[13px] truncate">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <div className="flex items-center gap-2 w-24 shrink-0 text-[13px] text-subtle">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      <div className="flex-1 min-w-0 text-[13px] truncate">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[12px] font-medium text-subtle uppercase tracking-wide">
      <Icon size={13} strokeWidth={1.75} />
      {label}
      <span className="text-subtle/70 normal-case font-normal">· {count}</span>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(task.done);

  return (
    <div className="flex items-start gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <button
        onClick={() =>
          startTransition(async () => {
            setDone((d) => !d);
            await toggleTask(task.id);
          })
        }
        disabled={pending}
        className="mt-0.5 text-subtle hover:text-foreground transition-colors shrink-0"
      >
        {done ? <CheckCircle2 size={15} strokeWidth={1.75} className="text-emerald-400" /> : <Circle size={15} strokeWidth={1.75} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] truncate ${done ? "line-through text-subtle" : ""}`}>{task.title}</p>
        {task.dueAt && <p className="text-[11px] text-subtle">{formatDue(task.dueAt)}</p>}
      </div>
    </div>
  );
}

function NoteRow({ note }: { note: NoteWithAuthor }) {
  return (
    <div className="px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <p className="text-[13px] whitespace-pre-wrap break-words">{note.body}</p>
      <p className="text-[11px] text-subtle mt-0.5">
        {note.createdBy?.name ?? note.createdBy?.email ?? "Unknown"} · {relativeTime(note.createdAt)}
      </p>
    </div>
  );
}

export function ContactQuickPreview({
  person,
  lastActivity,
  nextTask,
  tasks,
  notes,
  users,
  onClose,
  onComposeEmail,
}: {
  person: PersonRow;
  lastActivity?: Activity;
  nextTask?: Task;
  tasks: Task[];
  notes: NoteWithAuthor[];
  users: WorkspaceUser[];
  onClose: () => void;
  onComposeEmail: (person: PersonRow) => void;
}) {
  const name = fullName(person) || "Untitled";
  const [ownerId, setOwnerId] = useState(person.ownerId);
  const [ownerPending, startOwnerTransition] = useTransition();

  const upcomingTasks = tasks
    .filter((t) => isDueTodayOrLater(t.dueAt))
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });

  function handleOwnerChange(next: string | null) {
    setOwnerId(next);
    startOwnerTransition(async () => {
      await setPersonOwner(person.id, next);
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-40 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium text-subtle">Quick preview</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-4 flex items-center gap-3 border-b border-border">
            {person.company?.domain ? (
              <CompanyLogo domain={person.company.domain} fallbackText={initials(name) || "?"} size={40} rounded="rounded-full" className="text-[13px]" />
            ) : (
              <div className="size-10 shrink-0 rounded-full flex items-center justify-center text-[13px] font-medium bg-violet-500 text-white">
                {initials(name) || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-medium truncate">{name}</p>
              {person.jobTitle && <p className="text-[12px] text-subtle truncate">{person.jobTitle}</p>}
            </div>
          </div>

          <div className="px-3 pt-3 grid grid-cols-2 gap-2">
            <StatCard icon={History} label="Last Activity">
              {lastActivity ? relativeTime(lastActivity.createdAt) : "—"}
            </StatCard>
            <StatCard icon={CalendarClock} label="Next Activity">
              {nextTask ? (nextTask.dueAt ? formatDue(nextTask.dueAt) : nextTask.title) : "—"}
            </StatCard>
            <StatCard icon={CalendarDays} label="Created At">
              {formatDate(person.createdAt)}
            </StatCard>
            <div className="rounded-lg border border-border p-2.5 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-subtle uppercase tracking-wide">
                <UserCircle size={12} strokeWidth={1.75} />
                Owner
              </div>
              <select
                value={ownerId ?? ""}
                onChange={(e) => handleOwnerChange(e.target.value || null)}
                disabled={ownerPending}
                className="mt-1 w-full bg-transparent text-[13px] outline-none cursor-pointer disabled:opacity-50 -ml-0.5"
              >
                <option value="" className="bg-background text-foreground">
                  Unassigned
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-background text-foreground">
                    {u.name ?? u.email ?? "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-3 py-3">
            {person.email && (
              <Row icon={Mail} label="Email">
                <button
                  onClick={() => onComposeEmail(person)}
                  title="Compose email"
                  className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground text-[12px] truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  {person.email}
                </button>
              </Row>
            )}
            {person.phone && (
              <Row icon={Phone} label="Phone">
                {person.phone}
              </Row>
            )}
            {person.company && (
              <Row icon={Building2} label="Company">
                <Link
                  href={`/companies/${person.company.id}`}
                  className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  {person.company.name || "Untitled"}
                </Link>
              </Row>
            )}
            {person.linkedin && (
              <Row icon={Link2} label="LinkedIn">
                <a
                  href={person.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline truncate block"
                >
                  {person.linkedin}
                </a>
              </Row>
            )}
          </div>

          <div className="px-3 pt-1 pb-3 border-t border-border">
            <SectionHeader icon={CheckSquare} label="Tasks" count={upcomingTasks.length} />
            {upcomingTasks.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                {upcomingTasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-subtle px-1">No upcoming tasks.</p>
            )}
          </div>

          <div className="px-3 pt-1 pb-4 border-t border-border">
            <SectionHeader icon={StickyNote} label="Notes" count={notes.length} />
            {notes.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                {notes.map((n) => (
                  <NoteRow key={n.id} note={n} />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-subtle px-1">No notes yet.</p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border">
          {person.email && (
            <button
              onClick={() => onComposeEmail(person)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
            >
              <Mail size={14} strokeWidth={1.75} />
              Email
            </button>
          )}
          <Link
            href={`/contacts/${person.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-foreground hover:bg-muted transition-colors"
          >
            View full profile
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </Link>
        </div>
      </aside>
    </>
  );
}
