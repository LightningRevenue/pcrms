"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginationBar } from "@/components/pagination-bar";
import type { Activity, Company, ImportBatch, User } from "@prisma/client";
import {
  List,
  Building2,
  ChevronDown,
  Link2,
  UserCircle,
  CalendarDays,
  MapPin,
  Banknote,
  Plus,
  Trash2,
  History,
  PencilLine,
  X,
  Users,
  Globe2,
} from "lucide-react";
import { CreateCompanyPanel } from "@/components/create-company-panel";
import { BulkFieldDialog } from "@/components/bulk-field-dialog";
import { bulkUpdateCompanyField } from "@/lib/actions/bulk-fields";
import type { BulkCompanyField } from "@/lib/bulk-fields";
import { INDUSTRIES, COUNTRIES, REVENUE_RANGES, EMPLOYEE_BUCKETS } from "@/lib/firmographics";
import { CompanyLogo } from "@/components/company-logo";
import { deleteCompanies, setCompanyOwners } from "@/lib/actions/companies";
import { OwnerSelect } from "@/components/owner-select";
import { OwnerFilterPicker, NO_OWNER_KEY, type WorkspaceUser } from "@/components/owner-filter-picker";
import {
  ColumnHeader,
  AddColumnButton,
  useVisibleColumns,
  useColumnList,
  DEFAULT_COL_WIDTH,
  type SortDir,
} from "@/components/data-table-chrome";

export type CompanyRow = Company & {
  createdBy: User | null;
  owner: User | null;
  importBatch: ImportBatch | null;
};
export type CompanyCustomField = { id: string; key: string; label: string };

const STANDARD_COLUMNS = [
  { key: "domain", label: "Domain name", icon: Link2 },
  { key: "owner", label: "Owner", icon: UserCircle },
  { key: "createdBy", label: "Created by", icon: UserCircle },
  { key: "createdAt", label: "Creation date", icon: CalendarDays },
  { key: "linkedin", label: "Linkedin", icon: Link2 },
  { key: "address", label: "Address", icon: MapPin },
  { key: "industry", label: "Industry", icon: Building2 },
  { key: "country", label: "Country", icon: Globe2 },
  { key: "employeeCount", label: "Employees", icon: Users },
  { key: "annualRevenue", label: "Annual Revenue", icon: Banknote },
  { key: "lastActivity", label: "Last activity", icon: History },
] as const;

type StandardColumnKey = (typeof STANDARD_COLUMNS)[number]["key"];
type ColumnKey = StandardColumnKey | `custom:${string}`;

const DEFAULT_VISIBLE: ColumnKey[] = STANDARD_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "companies:visibleColumns";
const WIDTH_STORAGE_KEY = "companies:columnWidths";

// Columns backed by a real Company scalar, so the server can ORDER BY them. Everything else
// (lastActivity, custom fields) has no column to sort on and stays unsorted rather than
// silently sorting only the rows this page happens to hold.
const SERVER_SORTABLE: Partial<Record<StandardColumnKey, string>> = {
  domain: "domain",
  createdAt: "createdAt",
  linkedin: "linkedin",
  address: "address",
  industry: "industry",
  country: "country",
  employeeCount: "employeeCount",
  annualRevenue: "annualRevenue",
};

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

// `muted` is the dense-table look: a small neutral square that doesn't compete with the row's
// text — same treatment as the Contacts grid.
function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  if (muted) {
    return (
      <div className="size-4 shrink-0 rounded flex items-center justify-center text-[9px] font-medium bg-muted text-subtle border border-border">
        {(initials(name) || "?")[0]}
      </div>
    );
  }
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

function cellValue(
  c: CompanyRow,
  key: ColumnKey,
  lastActivityByCompany: Map<string, Activity>,
  customValuesByCompany?: Map<string, Record<string, string | null>>
): string {
  if (key.startsWith("custom:")) {
    return customValuesByCompany?.get(c.id)?.[key.slice("custom:".length)] ?? "";
  }
  switch (key as StandardColumnKey) {
    case "domain":
      return c.domain ?? "";
    case "owner":
      return c.owner?.name ?? c.owner?.email ?? "";
    case "createdBy":
      return c.createdBy?.name ?? c.createdBy?.email ?? "";
    case "createdAt":
      return relativeTime(c.createdAt);
    case "linkedin":
      return c.linkedin ?? "";
    case "address":
      return c.address ?? "";
    case "industry":
      return c.industry ?? "";
    case "country":
      return c.country ?? "";
    case "employeeCount":
      return c.employeeCount?.toString() ?? "";
    case "annualRevenue":
      return c.annualRevenue ?? "";
    case "lastActivity": {
      const a = lastActivityByCompany.get(c.id);
      return a ? relativeTime(a.createdAt) : "";
    }
  }
}

// Client-side comparable, used only by the un-paginated hosts (a List's detail page). /companies
// sorts in SQL instead — see SERVER_SORTABLE.
function sortValue(
  c: CompanyRow,
  key: ColumnKey,
  lastActivityByCompany: Map<string, Activity>
): number | string | null {
  if (key.startsWith("custom:")) return null;
  switch (key as StandardColumnKey) {
    case "createdAt":
      return c.createdAt.getTime();
    case "employeeCount":
      return c.employeeCount ?? null;
    case "lastActivity": {
      const a = lastActivityByCompany.get(c.id);
      return a ? a.createdAt.getTime() : null;
    }
    default:
      return cellValue(c, key, lastActivityByCompany) || null;
  }
}

function compareValues(a: number | string | null, b: number | string | null, dir: SortDir): number {
  // Rows with no value always sink to the bottom, regardless of direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? cmp : -cmp;
}

export function CompaniesView({
  companies,
  lastActivityByCompany,
  customFields,
  customValuesByCompany,
  title = "Companies",
  onAddClick,
  users = [],
  paging,
}: {
  companies: CompanyRow[];
  lastActivityByCompany: Map<string, Activity>;
  customFields: CompanyCustomField[];
  customValuesByCompany?: Map<string, Record<string, string | null>>;
  title?: string;
  onAddClick?: () => void;
  users?: WorkspaceUser[];
  // Only /companies paginates server-side; other hosts (a List's detail page) pass every row
  // and get client-side sorting plus the old un-paginated footer.
  paging?: {
    page: number;
    perPage: number;
    total: number;
    emptyLinkedin: number;
    withAddress: number;
    sort: string | null;
    dir: SortDir;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [changingOwner, setChangingOwner] = useState(false);
  const {
    visible: visibleColumns,
    toggle: toggleColumn,
    reorder: reorderColumn,
    widths: columnWidths,
    setWidth: setColumnWidth,
  } = useVisibleColumns<ColumnKey>(
    STORAGE_KEY,
    WIDTH_STORAGE_KEY,
    DEFAULT_VISIBLE,
    useMemo(
      () => [...STANDARD_COLUMNS.map((c) => c.key), ...customFields.map((f) => `custom:${f.id}` as const)],
      [customFields]
    ) as ColumnKey[]
  );

  // Owner filter only exists on the un-paginated hosts, for the same reason sorting is
  // server-side on /companies: filtering the loaded page would filter within a page.
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set());

  // Server-driven when paginated, local state otherwise.
  const [localSort, setLocalSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const sort = paging
    ? paging.sort
      ? { key: paging.sort as ColumnKey, dir: paging.dir }
      : null
    : localSort;

  const total = paging?.total ?? companies.length;
  const emptyLinkedin = paging?.emptyLinkedin ?? companies.filter((c) => !c.linkedin).length;
  const withAddress = paging?.withAddress ?? companies.filter((c) => c.address).length;

  function pushParams(mutate: (p: URLSearchParams) => void) {
    // Selection is by id and the next result set holds different rows, so carrying it across
    // would let a bulk action hit records no longer on screen.
    setSelected(new Set());
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/companies?${params.toString()}`, { scroll: false });
  }

  function goTo(page: number, perPage: number) {
    pushParams((p) => {
      p.set("page", String(page));
      p.set("size", String(perPage));
    });
  }

  // `dir` set = the header menu picked a direction outright; otherwise cycle asc → desc → off.
  function handleSort(key: ColumnKey, dir?: SortDir) {
    if (!paging) {
      setLocalSort((prev) => {
        if (dir) return { key, dir };
        if (!prev || prev.key !== key) return { key, dir: "asc" };
        if (prev.dir === "asc") return { key, dir: "desc" };
        return null;
      });
      return;
    }

    // Columns with no SQL equivalent would only sort the current page — leave them alone.
    if (!SERVER_SORTABLE[key as StandardColumnKey]) return;

    const nextDir: SortDir | null = dir
      ? dir
      : sort?.key !== key
        ? "asc"
        : sort.dir === "asc"
          ? "desc"
          : null;

    pushParams((p) => {
      if (nextDir) {
        p.set("sort", key);
        p.set("dir", nextDir);
      } else {
        p.delete("sort");
        p.delete("dir");
      }
      p.set("page", "1"); // a re-sort makes the old offset meaningless
    });
  }

  const visibleCompanies = useMemo(() => {
    let rows = companies;
    if (!paging && ownerFilter.size > 0) {
      rows = rows.filter((c) => ownerFilter.has(c.ownerId ?? NO_OWNER_KEY));
    }
    if (!paging && localSort) {
      const withValue = rows.map((c) => ({ c, v: sortValue(c, localSort.key, lastActivityByCompany) }));
      withValue.sort((a, b) => compareValues(a.v, b.v, localSort.dir));
      rows = withValue.map((x) => x.c);
    }
    return rows;
  }, [companies, paging, ownerFilter, localSort, lastActivityByCompany]);

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

  function handleChangeOwner(ownerId: string | null) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      await setCompanyOwners(ids, ownerId);
      setChangingOwner(false);
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Building2 size={14} strokeWidth={1.75} className="text-blue-400" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (onAddClick ? onAddClick() : setCreating(true))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            {onAddClick ? "Add Companies" : "New Company"}
          </button>
        </div>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All Companies
          <span className="text-subtle">
            · {visibleCompanies.length === total ? total : `${visibleCompanies.length} of ${total}`}
          </span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>

        {/* Selection actions live in the floating bar at the bottom (same as /contacts), so the
            toolbar keeps its own controls instead of swapping them out. */}
        <div className="flex items-center gap-1">
          {!paging && <OwnerFilterPicker users={users} selected={ownerFilter} onChange={setOwnerFilter} />}
          {/* Column visibility lives in the table header's "+" — see AddColumnButton. */}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <ListView
          companies={visibleCompanies}
          selected={selected}
          onSelectedChange={setSelected}
          visibleColumns={visibleColumns}
          customFields={customFields}
          lastActivityByCompany={lastActivityByCompany}
          customValuesByCompany={customValuesByCompany}
          sort={sort}
          onSort={handleSort}
          sortableKeys={paging ? SERVER_SORTABLE : null}
          columnWidths={columnWidths}
          onHideColumn={toggleColumn}
          onReorderColumn={reorderColumn}
          onResizeColumn={setColumnWidth}
          onAddRow={() => (onAddClick ? onAddClick() : setCreating(true))}
          onAddColumn={
            <AddColumnButton<ColumnKey>
              standardColumns={STANDARD_COLUMNS}
              customFields={customFields}
              visibleColumns={visibleColumns}
              onToggle={toggleColumn}
              customizeHref="/settings/data-model/company"
            />
          }
        />
      </div>

      <div className="h-9 shrink-0 flex items-center justify-end gap-6 px-6 border-t border-border text-[12px] text-subtle">
        <span>
          Empty of Linkedin{" "}
          <strong className="text-foreground">
            {total ? Math.round((emptyLinkedin / total) * 100) : 0}%
          </strong>
        </span>
        <span>
          Not empty of Address <strong className="text-foreground">{withAddress}</strong>
        </span>
        {paging && (
          <PaginationBar
            page={paging.page}
            perPage={paging.perPage}
            total={paging.total}
            label="companies"
            onPageChange={(p) => goTo(p, paging.perPage)}
            onPerPageChange={(n) => goTo(1, n)}
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-xl border border-border bg-surface shadow-xl">
          <span className="text-[13px] px-2 text-subtle">{selected.size} selected</span>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => setChangingOwner(true)}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <UserCircle size={14} strokeWidth={1.75} />
            Change Owner
          </button>
          <button
            onClick={() => setBulkEditing(true)}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <PencilLine size={14} strokeWidth={1.75} />
            Edit fields
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Delete
          </button>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => setSelected(new Set())}
            className="p-1.5 rounded-lg text-subtle hover:bg-muted hover:text-foreground transition-colors"
            title="Clear selection"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {bulkEditing && (
        <BulkFieldDialog
          title={`Edit ${selected.size} compan${selected.size === 1 ? "y" : "ies"}`}
          fields={[
            { field: "industry", label: "Industry", options: INDUSTRIES },
            { field: "country", label: "Country", options: COUNTRIES },
            { field: "revenueRange", label: "Revenue Range", options: REVENUE_RANGES },
            { field: "employeeCount", label: "Employees", options: EMPLOYEE_BUCKETS.map((b) => b.label) },
          ]}
          onApply={async (field, value) => {
            const res = await bulkUpdateCompanyField([...selected], field as BulkCompanyField, value);
            setBulkNotice(`Updated ${res.updated} compan${res.updated === 1 ? "y" : "ies"}.`);
            setSelected(new Set());
          }}
          onClose={() => setBulkEditing(false)}
        />
      )}

      {bulkNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-lg border border-border bg-surface shadow-xl text-[12.5px]">
          {bulkNotice}
          <button
            onClick={() => setBulkNotice(null)}
            className="ml-3 text-subtle hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {changingOwner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setChangingOwner(false)}>
          <div
            className="w-full max-w-xs rounded-lg border border-border bg-surface shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[13px] font-medium">
              Change owner for {selected.size} compan{selected.size === 1 ? "y" : "ies"}
            </p>
            <div className="mt-3 px-2.5 py-1.5 rounded-md border border-border">
              <OwnerSelect users={users} ownerId={null} onChange={handleChangeOwner} />
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setChangingOwner(false)}
                className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && <CreateCompanyPanel onClose={() => setCreating(false)} />}
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
  customValuesByCompany,
  sort,
  onSort,
  sortableKeys,
  columnWidths,
  onHideColumn,
  onReorderColumn,
  onResizeColumn,
  onAddRow,
  onAddColumn,
}: {
  companies: CompanyRow[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  visibleColumns: ColumnKey[];
  customFields: CompanyCustomField[];
  lastActivityByCompany: Map<string, Activity>;
  customValuesByCompany?: Map<string, Record<string, string | null>>;
  sort: { key: ColumnKey; dir: SortDir } | null;
  onSort: (key: ColumnKey, dir?: SortDir) => void;
  /** Null = every column sorts (client-side host). Otherwise only these keys offer a sort menu. */
  sortableKeys: Partial<Record<string, string>> | null;
  columnWidths?: Record<string, number>;
  onHideColumn?: (key: ColumnKey) => void;
  onReorderColumn?: (key: ColumnKey, before: ColumnKey) => void;
  onResizeColumn?: (key: ColumnKey, px: number) => void;
  onAddRow?: () => void;
  /** Rendered in the header's trailing cell — the "+" that adds a column. */
  onAddColumn?: React.ReactNode;
}) {
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const cols = useColumnList<ColumnKey>(visibleColumns, STANDARD_COLUMNS, customFields);

  // Trailing column holds the "+" and absorbs leftover width, so the last real column keeps its
  // own edge instead of stretching across the viewport.
  const gridTemplate = `28px 220px ${cols
    .map((c) => `${columnWidths?.[c.key] ?? DEFAULT_COL_WIDTH}px`)
    .join(" ")} minmax(36px, 1fr)`;
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
        className="grid pl-4 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <span className="flex items-center h-8">
          <input type="checkbox" className="size-3.5 rounded-sm accent-accent" checked={allSelected} onChange={toggleAll} />
        </span>
        <span className="flex items-center gap-1.5 h-8 px-2 border-l border-border">
          <Building2 size={13} strokeWidth={1.75} />
          Name
        </span>
        {cols.map((c) => {
          const sortable = !sortableKeys || !!sortableKeys[c.key];
          return (
            <ColumnHeader<ColumnKey>
              key={c.key}
              column={c}
              sort={sortable ? sort : null}
              onSort={sortable ? onSort : () => {}}
              onHide={onHideColumn}
              onDropBefore={onReorderColumn}
              onResize={onResizeColumn}
              dragging={dragKey}
              onDragKeyChange={setDragKey}
            />
          );
        })}
        <span className="flex items-center h-8 px-1.5 border-l border-border">{onAddColumn}</span>
      </div>
      <div className="divide-y divide-border">
        {companies.map((c) => (
          <div
            key={c.id}
            className="grid pl-4 items-stretch hover:bg-muted/40 transition-colors group/row"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className="flex items-center h-[33px]">
              <input
                type="checkbox"
                className="size-3.5 rounded-sm accent-accent"
                checked={selected.has(c.id)}
                onChange={() => toggleOne(c.id)}
              />
            </span>
            <Link
              href={`/companies/${c.id}`}
              className="flex items-center gap-2 min-w-0 h-[33px] px-2 border-l border-border group"
            >
              <CompanyLogo
                domain={c.domain}
                fallbackText={c.name ? c.name[0].toUpperCase() : "-"}
                size={16}
                className="text-[9px]"
              />
              <p className="text-[13px] leading-tight truncate text-foreground group-hover:underline decoration-subtle underline-offset-2">
                {c.name || "Untitled"}
              </p>
            </Link>
            {cols.map((col) => (
              <span
                key={col.key}
                className="flex items-center text-[13px] text-subtle truncate h-[33px] px-2 border-l border-border"
              >
                {col.key === "owner" || col.key === "createdBy" ? (
                  cellValue(c, col.key, lastActivityByCompany, customValuesByCompany) && (
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Avatar name={cellValue(c, col.key, lastActivityByCompany, customValuesByCompany)} muted />
                      <span className="truncate">
                        {cellValue(c, col.key, lastActivityByCompany, customValuesByCompany)}
                      </span>
                    </span>
                  )
                ) : (
                  cellValue(c, col.key, lastActivityByCompany, customValuesByCompany) || "—"
                )}
              </span>
            ))}
            <span className="border-l border-border" />
          </div>
        ))}
      </div>
      {onAddRow && (
        <button
          onClick={onAddRow}
          className="w-full flex items-center gap-2 h-[33px] pl-4 text-[13px] text-subtle border-b border-border hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <Plus size={13} strokeWidth={1.75} className="ml-0.5" />
          Add New
        </button>
      )}
    </div>
  );
}
