"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Activity, Company, ImportBatch, User } from "@prisma/client";
import {
  List,
  Building2,
  ChevronDown,
  ListFilter,
  ArrowUpDown,
  SlidersHorizontal,
  Link2,
  UserCircle,
  CalendarDays,
  MapPin,
  Banknote,
  Plus,
  ArrowUpRight,
  Trash2,
  History,
  Check,
} from "lucide-react";
import { CreateCompanyPanel } from "@/components/create-company-panel";
import { CompanyLogo } from "@/components/company-logo";
import { deleteCompanies } from "@/lib/actions/companies";

export type CompanyRow = Company & { createdBy: User | null; importBatch: ImportBatch | null };
export type CompanyCustomField = { id: string; key: string; label: string };

const STANDARD_COLUMNS = [
  { key: "domain", label: "Domain name", icon: Link2 },
  { key: "createdBy", label: "Created by", icon: UserCircle },
  { key: "createdAt", label: "Creation date", icon: CalendarDays },
  { key: "linkedin", label: "Linkedin", icon: Link2 },
  { key: "address", label: "Address", icon: MapPin },
  { key: "annualRevenue", label: "Annual Revenue", icon: Banknote },
  { key: "lastActivity", label: "Last activity", icon: History },
] as const;

type StandardColumnKey = (typeof STANDARD_COLUMNS)[number]["key"];
type ColumnKey = StandardColumnKey | `custom:${string}`;

const DEFAULT_VISIBLE: ColumnKey[] = STANDARD_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "companies:visibleColumns";

const AVATAR_COLORS = [
  "bg-rose-500 text-white",
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
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

function Avatar({ name }: { name: string }) {
  return (
    <div className={`size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-medium ${avatarColor(name || "?")}`}>
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

function useVisibleColumns(customFields: CompanyCustomField[]) {
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

function cellValue(
  c: CompanyRow,
  key: ColumnKey,
  lastActivityByCompany: Map<string, Activity>
): string {
  if (key.startsWith("custom:")) return "";
  switch (key as StandardColumnKey) {
    case "domain":
      return c.domain ?? "";
    case "createdBy":
      return c.createdBy?.name ?? c.createdBy?.email ?? "";
    case "createdAt":
      return relativeTime(c.createdAt);
    case "linkedin":
      return c.linkedin ?? "";
    case "address":
      return c.address ?? "";
    case "annualRevenue":
      return c.annualRevenue ?? "";
    case "lastActivity": {
      const a = lastActivityByCompany.get(c.id);
      return a ? relativeTime(a.createdAt) : "";
    }
  }
}

export function CompaniesView({
  companies,
  lastActivityByCompany,
  customFields,
  title = "Companies",
  onAddClick,
}: {
  companies: CompanyRow[];
  lastActivityByCompany: Map<string, Activity>;
  customFields: CompanyCustomField[];
  title?: string;
  onAddClick?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const { visible: visibleColumns, toggle: toggleColumn } = useVisibleColumns(customFields);
  const emptyLinkedin = companies.filter((c) => !c.linkedin).length;
  const withAddress = companies.filter((c) => c.address).length;

  function handleDeleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} compan${ids.length === 1 ? "y" : "ies"}?`)) return;

    startTransition(async () => {
      const result = await deleteCompanies(ids);
      setSelected(new Set());
      if (result.skipped > 0) {
        alert(`${result.deleted} deleted. ${result.skipped} skipped (linked to people or deals).`);
      }
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Building2 size={14} strokeWidth={1.75} className="text-blue-400" />
          <span className="font-medium">{title}</span>
        </div>
        <button
          onClick={() => (onAddClick ? onAddClick() : setCreating(true))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          {onAddClick ? "Add Companies" : "New Company"}
        </button>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All Companies
          <span className="text-subtle">· {companies.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-1">
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
              <PropertyPicker customFields={customFields} visibleColumns={visibleColumns} onToggle={toggleColumn} />
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <ListView
          companies={companies}
          selected={selected}
          onSelectedChange={setSelected}
          visibleColumns={visibleColumns}
          customFields={customFields}
          lastActivityByCompany={lastActivityByCompany}
        />
      </div>

      <div className="h-9 shrink-0 flex items-center justify-end gap-6 px-6 border-t border-border text-[12px] text-subtle">
        <span>
          Empty of Linkedin{" "}
          <strong className="text-foreground">
            {companies.length ? Math.round((emptyLinkedin / companies.length) * 100) : 0}%
          </strong>
        </span>
        <span>
          Not empty of Address <strong className="text-foreground">{withAddress}</strong>
        </span>
      </div>

      {creating && <CreateCompanyPanel onClose={() => setCreating(false)} />}
    </div>
  );
}

function PropertyPicker({
  customFields,
  visibleColumns,
  onToggle,
}: {
  customFields: CompanyCustomField[];
  visibleColumns: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <SlidersHorizontal size={14} strokeWidth={1.75} />
        Options
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-96 overflow-auto">
            <p className="px-3 py-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide">Properties</p>
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

function ListView({
  companies,
  selected,
  onSelectedChange,
  visibleColumns,
  customFields,
  lastActivityByCompany,
}: {
  companies: CompanyRow[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  visibleColumns: ColumnKey[];
  customFields: CompanyCustomField[];
  lastActivityByCompany: Map<string, Activity>;
}) {
  const cols = useMemo(() => {
    const standard = STANDARD_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => ({
      key: c.key as ColumnKey,
      label: c.label,
      icon: c.icon,
    }));
    const custom = customFields
      .filter((f) => visibleColumns.includes(`custom:${f.id}`))
      .map((f) => ({ key: `custom:${f.id}` as ColumnKey, label: f.label, icon: SlidersHorizontal }));
    return [...standard, ...custom];
  }, [visibleColumns, customFields]);

  const gridTemplate = `28px 220px ${cols.map(() => "180px").join(" ")}`;
  const allSelected = companies.length > 0 && companies.every((c) => selected.has(c.id));

  function toggleAll() {
    onSelectedChange(allSelected ? new Set() : new Set(companies.map((c) => c.id)));
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
          <Building2 size={13} strokeWidth={1.75} />
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
        {companies.map((c) => (
          <div
            key={c.id}
            className="grid px-6 py-2 items-center hover:bg-muted/40 transition-colors"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <input
              type="checkbox"
              className="size-3.5 rounded-sm accent-accent"
              checked={selected.has(c.id)}
              onChange={() => toggleOne(c.id)}
            />
            <Link href={`/companies/${c.id}`} className="flex items-center gap-2 min-w-0 pl-1 group">
              <CompanyLogo domain={c.domain} fallbackText={c.name ? c.name[0].toUpperCase() : "-"} size={20} className="text-[10px]" />
              <p className="text-[13px] leading-tight truncate px-2 py-0.5 rounded-md border border-border bg-muted group-hover:bg-muted/70 group-hover:border-subtle transition-colors">
                {c.name || "Untitled"}
              </p>
              <ArrowUpRight
                size={13}
                strokeWidth={1.75}
                className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              />
            </Link>
            {cols.map((col) => (
              <span key={col.key} className="text-[13px] text-subtle truncate pl-1 pr-2">
                {col.key === "createdBy" ? (
                  cellValue(c, col.key, lastActivityByCompany) && (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={cellValue(c, col.key, lastActivityByCompany)} />
                      {cellValue(c, col.key, lastActivityByCompany)}
                    </span>
                  )
                ) : (
                  cellValue(c, col.key, lastActivityByCompany) || "—"
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
