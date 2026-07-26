"use client";

import { useMemo, useState, useTransition } from "react";
import type { Call, CallOpportunity, Email, EmailOpen, Note, NoteOpportunity, Opportunity, Task, TaskOpportunity, User } from "@prisma/client";
import { Mail, StickyNote, Phone, CheckSquare, Search, ChevronDown, ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { renderNoteBody } from "@/components/contact-notes-tab";
import { CALL_DISPOSITIONS } from "@/lib/call-dispositions";
import { toggleTask } from "@/lib/actions/tasks";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

type FeedEmail = Email & { opens: EmailOpen[] };
type FeedNote = Note & { createdBy: User | null; opportunities: (NoteOpportunity & { opportunity: Opportunity })[] };
type FeedTask = Task & { opportunities: (TaskOpportunity & { opportunity: Opportunity })[] };
type FeedCall = Call & { createdBy: User | null; opportunities: CallOpportunity[] };

export type FeedKind = "email" | "note" | "call" | "task";

// One row of the merged feed. `at` drives ordering/grouping, `search` is the pre-lowercased
// haystack, and `body` renders only once the row is expanded.
type FeedItem = {
  id: string;
  kind: FeedKind;
  at: Date;
  title: React.ReactNode;
  meta: React.ReactNode;
  body: React.ReactNode;
  search: string;
  upcoming: boolean;
};

const KIND_META = {
  email: { label: "Email", icon: Mail },
  note: { label: "Note", icon: StickyNote },
  call: { label: "Call", icon: Phone },
  task: { label: "Task", icon: CheckSquare },
} as const;

const RANGES = [
  { key: "all", label: "All time", days: null },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function actorName(user: User | null) {
  return user?.name ?? user?.email ?? "Someone";
}

export function ContactActivityFeed({
  personName,
  emails,
  notes,
  calls,
  tasks,
  users,
}: {
  personName: string;
  emails: FeedEmail[];
  notes: FeedNote[];
  calls: FeedCall[];
  tasks: FeedTask[];
  users: WorkspaceUser[];
}) {
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<FeedKind[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const items = useMemo<FeedItem[]>(() => {
    const now = Date.now();

    const emailItems = emails.map<FeedItem>((e) => ({
      id: `email-${e.id}`,
      kind: "email",
      at: e.sentAt,
      title: (
        <>
          <span className="font-medium">Email</span>
          {e.subject ? <> — {e.subject}</> : null}
        </>
      ),
      meta: (
        <>
          <span className="text-subtle">
            {e.direction === "sent" ? `to ${e.to.join(", ") || personName}` : `from ${e.from}`}
          </span>
          {e.opens.length > 0 && <span className="text-emerald-400">Opens: {e.opens.length}</span>}
        </>
      ),
      body: (
        <div
          className="prose-email text-[13px] leading-relaxed [&_a]:text-accent"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(e.bodyHtml) }}
        />
      ),
      search: `${e.subject} ${e.from} ${e.to.join(" ")}`.toLowerCase(),
      upcoming: false,
    }));

    const noteItems = notes.map<FeedItem>((n) => ({
      id: `note-${n.id}`,
      kind: "note",
      at: n.createdAt,
      title: (
        <>
          <span className="font-medium">Note</span> by {actorName(n.createdBy)}
        </>
      ),
      meta: null,
      body: <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{renderNoteBody(n.body, users)}</p>,
      search: n.body.toLowerCase(),
      upcoming: false,
    }));

    const callItems = calls.map<FeedItem>((c) => {
      const disposition = CALL_DISPOSITIONS.find((d) => d.value === c.disposition);
      return {
        id: `call-${c.id}`,
        kind: "call",
        at: c.startedAt,
        title: (
          <>
            <span className="font-medium">Call</span> by {actorName(c.createdBy)}
          </>
        ),
        meta: (
          <>
            <span className="text-subtle">{c.toNumber}</span>
            {c.durationSec ? <span className="text-subtle">{formatDuration(c.durationSec)}</span> : null}
            {disposition && <span className="text-subtle">{disposition.label}</span>}
          </>
        ),
        body: c.recordingUrl ? (
          <audio controls src={c.recordingUrl} className="w-full max-w-md" />
        ) : (
          <p className="text-[13px] text-subtle">No recording.</p>
        ),
        search: `${c.toNumber} ${c.disposition ?? ""} ${c.status}`.toLowerCase(),
        upcoming: false,
      };
    });

    const taskItems = tasks.map<FeedItem>((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      at: t.dueAt ?? t.createdAt,
      title: (
        <>
          <span className="font-medium">Task</span> — {t.title}
        </>
      ),
      meta: t.dueAt ? <span className="text-subtle">Due: {formatTime(t.dueAt)}</span> : null,
      body: t.description ? (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{t.description}</p>
      ) : (
        <p className="text-[13px] text-subtle">No description.</p>
      ),
      search: `${t.title} ${t.description ?? ""}`.toLowerCase(),
      // Open tasks dated in the future sort into their own "Upcoming" block, like HubSpot.
      upcoming: !t.done && !!t.dueAt && t.dueAt.getTime() > now,
    }));

    return [...emailItems, ...noteItems, ...callItems, ...taskItems].sort(
      (a, b) => b.at.getTime() - a.at.getTime()
    );
  }, [emails, notes, calls, tasks, users, personName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = RANGES.find((r) => r.key === range)?.days;
    const min = cutoff ? Date.now() - cutoff * 86_400_000 : null;
    return items.filter(
      (i) =>
        (kinds.length === 0 || kinds.includes(i.kind)) &&
        (!q || i.search.includes(q)) &&
        // A future-dated task is never older than the cutoff, so it survives every range.
        (min === null || i.at.getTime() >= min || i.upcoming)
    );
  }, [items, query, kinds, range]);

  const upcoming = filtered.filter((i) => i.upcoming).sort((a, b) => a.at.getTime() - b.at.getTime());
  const past = filtered.filter((i) => !i.upcoming);

  // Preserves the newest-first order the sort already produced.
  const months = past.reduce<[string, FeedItem[]][]>((acc, item) => {
    const key = monthKey(item.at);
    const last = acc[acc.length - 1];
    if (last && last[0] === key) last[1].push(item);
    else acc.push([key, [item]]);
    return acc;
  }, []);

  function toggleKind(kind: FeedKind) {
    setKinds((k) => (k.includes(kind) ? k.filter((x) => x !== kind) : [...k, kind]));
  }

  function toggleExpanded(id: string) {
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  function completeTask(itemId: string) {
    setCompleted((c) => [...c, itemId]);
    startTransition(() => toggleTask(itemId.replace("task-", "")));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border min-w-[220px]">
          <Search size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activities…"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
        </div>
        <button
          onClick={() => setExpanded(expanded.length > 0 ? [] : filtered.map((i) => i.id))}
          className="text-[13px] text-subtle hover:text-foreground transition-colors"
        >
          {expanded.length > 0 ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {(Object.keys(KIND_META) as FeedKind[]).map((kind) => {
          const { label, icon: Icon } = KIND_META[kind];
          const on = kinds.includes(kind);
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] transition-colors ${
                on ? "border-accent bg-accent/10 text-foreground" : "border-border text-subtle hover:text-foreground"
              }`}
            >
              <Icon size={12} strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as typeof range)}
          className="ml-auto bg-transparent text-[12px] text-subtle outline-none border border-border rounded-full px-2.5 py-1 cursor-pointer"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key} className="bg-background text-foreground">
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-subtle mt-6 px-1">
          {items.length === 0 ? "No activity yet." : "No activities match your filters."}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {upcoming.length > 0 && (
            <FeedGroup
              label="Upcoming"
              items={upcoming}
              expanded={expanded}
              completed={completed}
              onToggle={toggleExpanded}
              onComplete={completeTask}
            />
          )}
          {months.map(([label, group]) => (
            <FeedGroup
              key={label}
              label={label}
              items={group}
              expanded={expanded}
              completed={completed}
              onToggle={toggleExpanded}
              onComplete={completeTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedGroup({
  label,
  items,
  expanded,
  completed,
  onToggle,
  onComplete,
}: {
  label: string;
  items: FeedItem[];
  expanded: string[];
  completed: string[];
  onToggle: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[12px] font-medium text-subtle px-1">{label}</p>
      <div className="mt-1.5 space-y-1.5">
        {items.map((item) => {
          const open = expanded.includes(item.id);
          const done = completed.includes(item.id);
          const Icon = KIND_META[item.kind].icon;
          return (
            <div key={item.id} className="border border-border rounded-lg bg-surface overflow-hidden">
              <div className="flex items-start gap-2 px-3 py-2.5">
                <button
                  onClick={() => onToggle(item.id)}
                  className="mt-0.5 text-subtle hover:text-foreground transition-colors shrink-0"
                  title={open ? "Collapse" : "Expand"}
                >
                  {open ? (
                    <ChevronDown size={14} strokeWidth={1.75} />
                  ) : (
                    <ChevronRight size={14} strokeWidth={1.75} />
                  )}
                </button>
                <Icon size={14} strokeWidth={1.75} className="text-subtle shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <button onClick={() => onToggle(item.id)} className="text-left w-full">
                    <p className={`text-[13px] leading-snug ${done ? "line-through text-subtle" : ""}`}>
                      {item.title}
                    </p>
                  </button>
                  {item.meta && (
                    <div className="flex items-center gap-2 flex-wrap text-[12px] mt-0.5">{item.meta}</div>
                  )}
                </div>
                {item.kind === "task" && item.upcoming && (
                  <button
                    onClick={() => onComplete(item.id)}
                    disabled={done}
                    title="Mark complete"
                    className="shrink-0 text-subtle hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {done ? (
                      <CheckCircle2 size={15} strokeWidth={1.75} className="text-accent" />
                    ) : (
                      <Circle size={15} strokeWidth={1.75} />
                    )}
                  </button>
                )}
                <span className="text-[12px] text-subtle shrink-0 whitespace-nowrap">{formatTime(item.at)}</span>
              </div>
              {open && <div className="border-t border-border px-3 py-3">{item.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
