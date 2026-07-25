"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, User as PersonIcon, CheckSquare, FileText } from "lucide-react";
import type { PipelineStage, Task, Note, User } from "@prisma/client";
import { moveOpportunityStage, getOpportunity } from "@/lib/actions/opportunities";
import { toggleTask, createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";

type OpportunityDetail = Awaited<ReturnType<typeof getOpportunity>>;
type NoteWithAuthor = Note & { createdBy: User | null };

function formatCurrency(value: number) {
  return `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`;
}

export function MobileDealDetail({
  opportunity,
  stages,
  tasks,
  notes,
}: {
  opportunity: NonNullable<OpportunityDetail>;
  stages: PipelineStage[];
  tasks: Task[];
  notes: NoteWithAuthor[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeStage(stage: string) {
    startTransition(async () => {
      await moveOpportunityStage(opportunity.id, stage);
      router.refresh();
    });
  }

  return (
    <div className="pb-6">
      <div className="p-4 space-y-3 border-b border-border">
        <h1 className="text-[17px] font-bold">{opportunity.name}</h1>
        <p className="text-2xl font-bold text-accent">{formatCurrency(opportunity.value)}</p>

        <select
          value={opportunity.stage}
          disabled={isPending}
          onChange={(e) => changeStage(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] font-medium focus:outline-none focus:border-accent"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        {opportunity.contact && (
          <Link
            href={`/m/contacts/${opportunity.contact.id}`}
            className="flex items-center gap-2 text-[13px] text-subtle"
          >
            <PersonIcon size={14} />
            {[opportunity.contact.firstName, opportunity.contact.lastName].filter(Boolean).join(" ")}
          </Link>
        )}
        {opportunity.company && (
          <div className="flex items-center gap-2 text-[13px] text-subtle">
            <Building2 size={14} />
            {opportunity.company.name}
          </div>
        )}
      </div>

      <Section title="Tasks" icon={CheckSquare}>
        <TasksList tasks={tasks} opportunityId={opportunity.id} personId={opportunity.contact?.id ?? null} />
      </Section>

      <Section title="Notes" icon={FileText}>
        <NotesList notes={notes} opportunityId={opportunity.id} personId={opportunity.contact?.id ?? null} />
      </Section>
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

function TasksList({
  tasks,
  opportunityId,
  personId,
}: {
  tasks: Task[];
  opportunityId: string;
  personId: string | null;
}) {
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
    if (!title.trim() || !personId) return;
    startTransition(async () => {
      await createTask({ personId, title, type: "general", due: "", priority: "medium", opportunityIds: [opportunityId] });
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

      {personId &&
        (showAdd ? (
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
        ))}
    </div>
  );
}

function NotesList({
  notes,
  opportunityId,
  personId,
}: {
  notes: NoteWithAuthor[];
  opportunityId: string;
  personId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function addNote() {
    if (!body.trim() || !personId) return;
    startTransition(async () => {
      await createNote(personId, body, [opportunityId]);
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {personId && (
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
      )}

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
