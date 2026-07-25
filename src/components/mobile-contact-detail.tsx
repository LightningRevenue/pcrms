"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, Building2, CheckSquare, FileText, PhoneCall } from "lucide-react";
import type { Person, Company, Task, Note, User, Call } from "@prisma/client";
import { toggleTask, createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";

type ContactWithCompany = Person & { company: Company | null };
type NoteWithAuthor = Note & { createdBy: User | null };

export function MobileContactDetail({
  contact,
  tasks,
  notes,
  calls,
}: {
  contact: ContactWithCompany;
  tasks: Task[];
  notes: NoteWithAuthor[];
  calls: Call[];
}) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  return (
    <div className="pb-6">
      <div className="p-4 space-y-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="size-12 shrink-0 rounded-full bg-muted flex items-center justify-center text-[18px] font-bold text-subtle">
            {name[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold truncate">{name}</h1>
            {contact.company && (
              <p className="text-[12.5px] text-subtle flex items-center gap-1 truncate">
                <Building2 size={12} /> {contact.company.name}
              </p>
            )}
            {contact.stage && (
              <span className="inline-block mt-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent text-[11px] font-semibold px-2 py-0.5">
                {contact.stage}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[13px] font-medium active:bg-muted"
            >
              <Phone size={14} /> Call
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[13px] font-medium active:bg-muted"
            >
              <Mail size={14} /> Email
            </a>
          )}
        </div>
      </div>

      <Section title="Tasks" icon={CheckSquare}>
        <TasksList tasks={tasks} personId={contact.id} />
      </Section>

      <Section title="Notes" icon={FileText}>
        <NotesList notes={notes} personId={contact.id} />
      </Section>

      {calls.length > 0 && (
        <Section title="Calls" icon={PhoneCall}>
          <div className="space-y-2">
            {calls.map((c) => (
              <div key={c.id} className="text-[13px] flex items-center justify-between">
                <span className="text-subtle">{new Date(c.startedAt).toLocaleString()}</span>
                <span className="capitalize">{c.disposition ?? c.status}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof CheckSquare; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-border space-y-3">
      <h2 className="text-[12px] font-bold text-subtle uppercase tracking-wider flex items-center gap-1.5">
        <Icon size={13} /> {title}
      </h2>
      {children}
    </div>
  );
}

function TasksList({ tasks, personId }: { tasks: Task[]; personId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");

  function toggle(id: string) {
    startTransition(async () => {
      await toggleTask(id);
      router.refresh();
    });
  }

  function addTask() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({ personId, title, type: "general", due: "", priority: "medium" });
      setTitle("");
      setShowAdd(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 && !showAdd && <p className="text-[13px] text-subtle">No tasks yet.</p>}
      {tasks.map((t) => (
        <label key={t.id} className="flex items-start gap-2.5 text-[13.5px]">
          <input
            type="checkbox"
            checked={t.done}
            disabled={isPending}
            onChange={() => toggle(t.id)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span className={t.done ? "line-through text-subtle" : ""}>{t.title}</span>
        </label>
      ))}

      {showAdd ? (
        <div className="flex gap-2 pt-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="New task..."
            className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:border-accent"
          />
          <button
            onClick={addTask}
            disabled={!title.trim() || isPending}
            className="rounded-lg bg-accent text-white text-[13px] font-semibold px-3 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="text-[12.5px] text-accent font-medium">
          + Add task
        </button>
      )}
    </div>
  );
}

function NotesList({ notes, personId }: { notes: NoteWithAuthor[]; personId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function addNote() {
    if (!body.trim()) return;
    startTransition(async () => {
      await createNote(personId, body);
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="Add a note..."
          className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:border-accent"
        />
        <button
          onClick={addNote}
          disabled={!body.trim() || isPending}
          className="rounded-lg bg-accent text-white text-[13px] font-semibold px-3 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[13px] text-subtle">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-surface p-2.5">
              <p className="text-[13px] whitespace-pre-wrap">{n.body}</p>
              <p className="text-[11px] text-subtle mt-1">
                {n.createdBy?.name ?? "Someone"} · {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
