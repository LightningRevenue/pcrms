"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Activity, Company, ImportBatch, Person, Task, User } from "@prisma/client";
import {
  List,
  KanbanSquare,
  Check,
  Users,
  ChevronDown,
  ListFilter,
  ArrowUpDown,
  SlidersHorizontal as OptionsIcon,
  Mail,
  UserCircle,
  Building2,
  Phone,
  CalendarDays,
  Briefcase,
  Link2,
  ArrowUpRight,
  Plus,
  Trash2,
  History,
  CalendarClock,
} from "lucide-react";
import { CreateContactPanel } from "@/components/create-contact-panel";
import { CompanyLogo } from "@/components/company-logo";
import { deleteContacts } from "@/lib/actions/contacts";
import { EmailComposer, type ComposerDraft } from "@/components/email-composer";

export type PersonRow = Person & { company: Company | null; createdBy: User | null; importBatch: ImportBatch | null };
export type PersonCustomField = { id: string; key: string; label: string };

const AVATAR_COLORS = [
  "bg-rose-500 text-white",
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
];

function fullName(p: Pick<Person, "firstName" | "lastName">) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

const STANDARD_COLUMNS = [
  { key: "email", label: "Emails", icon: Mail },
  { key: "createdBy", label: "Created by", icon: UserCircle },
  { key: "company", label: "Company", icon: Building2 },
  { key: "phone", label: "Phones", icon: Phone },
  { key: "createdAt", label: "Creation date", icon: CalendarDays },
  { key: "jobTitle", label: "Job Title", icon: Briefcase },
  { key: "linkedin", label: "Linkedin", icon: Link2 },
  { key: "lastActivity", label: "Last activity", icon: History },
  { key: "nextActivity", label: "Next activity", icon: CalendarClock },
] as const;

type StandardColumnKey = (typeof STANDARD_COLUMNS)[number]["key"];
type ColumnKey = StandardColumnKey | `custom:${string}`;

const DEFAULT_VISIBLE: ColumnKey[] = STANDARD_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "contacts:visibleColumns";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className={`size-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-medium ${avatarColor(name || "?")}`}>
      {initials(name) || "?"}
    </div>
  );
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

function useVisibleColumns(customFields: PersonCustomField[]) {
  const allKeys = useMemo<ColumnKey[]>(
    () => [...STANDARD_COLUMNS.map((c) => c.key), ...customFields.map((f) => `custom:${f.id}` as const)],
    [customFields]
  );
  const [visible, setVisible] = useState<ColumnKey[]>(DEFAULT_VISIBLE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed: string[] = JSON.parse(stored);
      setVisible(parsed.filter((k): k is ColumnKey => allKeys.includes(k as ColumnKey)));
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: ColumnKey) {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { visible, toggle, allKeys };
}

export function ContactsView({
  people,
  lastActivityByPerson,
  nextTaskByPerson,
  customFields,
  title = "People",
  onAddClick,
}: {
  people: PersonRow[];
  lastActivityByPerson: Map<string, Activity>;
  nextTaskByPerson: Map<string, Task>;
  customFields: PersonCustomField[];
  title?: string;
  onAddClick?: () => void;
}) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const { visible: visibleColumns, toggle: toggleColumn } = useVisibleColumns(customFields);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ComposerDraft | null>(null);

  function handleDeleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} contact${ids.length === 1 ? "" : "s"}?`)) return;

    startTransition(async () => {
      const result = await deleteContacts(ids);
      setSelected(new Set());
      if (result.skipped > 0) {
        alert(`${result.deleted} deleted. ${result.skipped} skipped (linked to deals).`);
      }
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Users size={14} strokeWidth={1.75} className="text-violet-400" />
          <span className="font-medium">{title}</span>
        </div>
        <button
          onClick={() => (onAddClick ? onAddClick() : setCreating(true))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          {onAddClick ? "Add People" : "New Person"}
        </button>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All People
          <span className="text-subtle">· {people.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("kanban")}
            className={`p-1.5 rounded-md transition-colors ${
              view === "kanban" ? "bg-muted text-foreground" : "text-subtle hover:bg-muted hover:text-foreground"
            }`}
            title="Kanban view"
          >
            <KanbanSquare size={14} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded-md transition-colors ${
              view === "list" ? "bg-muted text-foreground" : "text-subtle hover:bg-muted hover:text-foreground"
            }`}
            title="List view"
          >
            <List size={14} strokeWidth={1.75} />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {selected.size > 0 ? (
            <button
              onClick={handleDeleteSelected}
              disabled={pending}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete {selected.size} selected
            </button>
          ) : (
            <>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
                <ListFilter size={14} strokeWidth={1.75} />
                Filter
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
                <ArrowUpDown size={14} strokeWidth={1.75} />
                Sort
              </button>
              {view === "list" && (
                <PropertyPicker customFields={customFields} visibleColumns={visibleColumns} onToggle={toggleColumn} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === "list" ? (
          <ListView
            people={people}
            visibleColumns={visibleColumns}
            customFields={customFields}
            selected={selected}
            onSelectedChange={setSelected}
            onComposeEmail={(p) => setDraft({ personId: p.id, to: p.email ? [p.email] : [], contactFirstName: p.firstName })}
            lastActivityByPerson={lastActivityByPerson}
            nextTaskByPerson={nextTaskByPerson}
          />
        ) : (
          <div className="p-6">
            <KanbanView people={people} />
          </div>
        )}
      </div>

      {view === "list" && (
        <div className="h-9 shrink-0 flex items-center justify-end gap-6 px-6 border-t border-border text-[12px] text-subtle">
          <span>Unique of Emails {people.length}</span>
        </div>
      )}

      {creating && <CreateContactPanel onClose={() => setCreating(false)} />}
      {draft && <EmailComposer draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function PropertyPicker({
  customFields,
  visibleColumns,
  onToggle,
}: {
  customFields: PersonCustomField[];
  visibleColumns: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <OptionsIcon size={14} strokeWidth={1.75} />
        Options
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-96 overflow-auto">
            <p className="px-3 py-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide">
              Properties
            </p>
            {STANDARD_COLUMNS.map((col) => {
              const checked = visibleColumns.includes(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <col.icon size={13} strokeWidth={1.75} className="text-subtle" />
                    {col.label}
                  </span>
                  {checked && <Check size={14} strokeWidth={2} />}
                </button>
              );
            })}
            {customFields.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide border-t border-border mt-1">
                  Custom fields
                </p>
                {customFields.map((f) => {
                  const key: ColumnKey = `custom:${f.id}`;
                  const checked = visibleColumns.includes(key);
                  return (
                    <button
                      key={f.id}
                      onClick={() => onToggle(key)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                    >
                      <span className="truncate">{f.label}</span>
                      {checked && <Check size={14} strokeWidth={2} className="shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function cellValue(
  p: PersonRow,
  key: ColumnKey,
  lastActivityByPerson: Map<string, Activity>,
  nextTaskByPerson: Map<string, Task>
): string {
  if (key.startsWith("custom:")) return "";
  switch (key as StandardColumnKey) {
    case "email":
      return p.email ?? "";
    case "createdBy":
      return p.createdBy?.name ?? p.createdBy?.email ?? "";
    case "company":
      return p.company?.name ?? "";
    case "phone":
      return p.phone ?? "";
    case "createdAt":
      return relativeTime(p.createdAt);
    case "jobTitle":
      return p.jobTitle ?? "";
    case "linkedin":
      return p.linkedin ?? "";
    case "lastActivity": {
      const a = lastActivityByPerson.get(p.id);
      return a ? relativeTime(a.createdAt) : "";
    }
    case "nextActivity": {
      const t = nextTaskByPerson.get(p.id);
      if (!t) return "";
      return t.dueAt ? formatDue(t.dueAt) : t.title;
    }
  }
}

function ListView({
  people,
  visibleColumns,
  customFields,
  selected,
  onSelectedChange,
  onComposeEmail,
  lastActivityByPerson,
  nextTaskByPerson,
}: {
  people: PersonRow[];
  visibleColumns: ColumnKey[];
  customFields: PersonCustomField[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onComposeEmail: (person: PersonRow) => void;
  lastActivityByPerson: Map<string, Activity>;
  nextTaskByPerson: Map<string, Task>;
}) {
  const cols = useMemo(() => {
    const standard = STANDARD_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => ({
      key: c.key as ColumnKey,
      label: c.label,
      icon: c.icon,
    }));
    const custom = customFields
      .filter((f) => visibleColumns.includes(`custom:${f.id}`))
      .map((f) => ({ key: `custom:${f.id}` as ColumnKey, label: f.label, icon: OptionsIcon }));
    return [...standard, ...custom];
  }, [visibleColumns, customFields]);

  const gridTemplate = `28px 220px ${cols.map(() => "180px").join(" ")}`;
  const allSelected = people.length > 0 && people.every((p) => selected.has(p.id));

  function toggleAll() {
    onSelectedChange(allSelected ? new Set() : new Set(people.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  return (
    <div className="min-w-max">
      <div
        className="grid px-6 py-2 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <input type="checkbox" className="size-3.5 rounded-sm accent-accent" checked={allSelected} onChange={toggleAll} />
        <span className="flex items-center gap-1.5 pl-1">
          <UserCircle size={13} strokeWidth={1.75} />
          Name
        </span>
        {cols.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5 pl-1 truncate">
            <c.icon size={13} strokeWidth={1.75} />
            {c.label}
          </span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {people.map((p) => {
          const name = fullName(p);
          return (
            <div
              key={p.id}
              className="grid px-6 py-2 items-center hover:bg-muted/40 transition-colors"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <input
                type="checkbox"
                className="size-3.5 rounded-sm accent-accent"
                checked={selected.has(p.id)}
                onChange={() => toggleOne(p.id)}
              />
              <Link href={`/contacts/${p.id}`} className="flex items-center gap-2 min-w-0 pl-1 group">
                {p.company?.domain ? (
                  <CompanyLogo domain={p.company.domain} fallbackText={initials(name) || "?"} size={24} rounded="rounded-full" className="text-[10px]" />
                ) : (
                  <Avatar name={name} />
                )}
                <p className="text-[13px] leading-tight truncate px-2 py-0.5 rounded-md border border-border bg-muted group-hover:bg-muted/70 group-hover:border-subtle transition-colors">
                  {name}
                </p>
                <ArrowUpRight
                  size={13}
                  strokeWidth={1.75}
                  className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </Link>
              {cols.map((col) => (
                <span key={col.key} className="text-[13px] text-subtle truncate pl-1 pr-2">
                  {col.key === "email" && p.email ? (
                    <button
                      onClick={() => onComposeEmail(p)}
                      title="Compose email"
                      className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground text-[12px] truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                    >
                      {p.email}
                    </button>
                  ) : col.key === "createdBy" ? (
                    cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson) && (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson)} />
                        {cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson)}
                      </span>
                    )
                  ) : (
                    cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson) || "—"
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanView({ people }: { people: PersonRow[] }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-[13px] text-subtle">
        Kanban groups by status — add a status field in Settings to enable this view.
      </p>
      <p className="text-[12px] text-subtle mt-1">{people.length} people, ungrouped for now.</p>
    </div>
  );
}
