"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Activity, Company, ContactPipelineStage, ImportBatch, Note, Person, Task, User } from "@prisma/client";
import {
  List,
  KanbanSquare,
  Check,
  Users,
  ChevronDown,
  ChevronUp,
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
  X,
  Eye,
  EyeOff,
  Megaphone,
  PencilLine,
} from "lucide-react";
import { CreateContactPanel } from "@/components/create-contact-panel";
import { CompanyLogo } from "@/components/company-logo";
import { PaginationBar } from "@/components/pagination-bar";
import { DEFAULT_PAGE_SIZE } from "@/lib/paging";
import { deleteContacts, setPersonOwners } from "@/lib/actions/contacts";
import { moveContactStage, bulkMoveUnstagedContacts } from "@/lib/actions/contact-pipeline-stages";
import { BulkFieldDialog } from "@/components/bulk-field-dialog";
import { bulkUpdatePersonField, bulkUpdateCompanyForContacts } from "@/lib/actions/bulk-fields";
import type { BulkPersonField, BulkCompanyField } from "@/lib/bulk-fields";
import { INDUSTRIES, COUNTRIES, REVENUE_RANGES, EMPLOYEE_BUCKETS } from "@/lib/firmographics";
import { EmailComposer, type ComposerDraft } from "@/components/email-composer";
import { OwnerSelect } from "@/components/owner-select";
import { ContactQuickPreview } from "@/components/contact-quick-preview";
import { OwnerFilterPicker, NO_OWNER_KEY, type WorkspaceUser } from "@/components/owner-filter-picker";
import { CampaignFilterPicker } from "@/components/campaign-filter-picker";
import { ProspectFilterBar, type ProspectFilterOptions } from "@/components/prospect-filter-bar";
import { SaveViewDialog } from "@/components/save-view-dialog";
import {
  createSavedView,
  updateSavedViewFilters,
  deleteSavedView,
  type SavedView,
} from "@/lib/actions/saved-prospect-views";
import {
  matchesProspectFilters,
  prospectFiltersEqual,
  hasAnyFilter,
  type MatchablePerson,
  type ProspectFilters,
} from "@/lib/prospect-filters";
import { useViewMode } from "@/lib/view-mode";
import {
  ColumnHeader,
  AddColumnButton,
  useVisibleColumns,
  useColumnList,
  DEFAULT_COL_WIDTH,
  type SortDir,
} from "@/components/data-table-chrome";

export type PersonRow = Person & {
  company: Company | null;
  createdBy: User | null;
  owner: User | null;
  importBatch: ImportBatch | null;
  campaignMembers: { repliedAt?: Date | null; campaign: { id: string; name: string } }[];
};
export type PersonCustomField = { id: string; key: string; label: string };
export type NoteWithAuthor = Note & { createdBy: User | null };

// Bridges a loaded row to the shape matchesProspectFilters expects. The extra maps come from
// the Contacts page; without them those filters simply match nothing rather than throwing.
function toMatchable(
  p: PersonRow,
  lastActivityByPerson: Map<string, Activity>,
  customValuesByPerson?: Map<string, Record<string, string | null>>,
  contactsPerCompany?: Map<string, number>
): MatchablePerson {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    jobTitle: p.jobTitle,
    seniority: p.seniority,
    department: p.department,
    stage: p.stage,
    ownerId: p.ownerId,
    createdAt: p.createdAt,
    unsubscribedAt: p.unsubscribedAt,
    emailVerifiedStatus: p.emailVerifiedStatus,
    importBatchId: p.importBatchId,
    companyId: p.companyId,
    companyName: p.company?.name ?? null,
    industry: p.company?.industry ?? null,
    country: p.company?.country ?? null,
    revenueRange: p.company?.revenueRange ?? null,
    employeeCount: p.company?.employeeCount ?? null,
    campaignIds: p.campaignMembers.map((m) => m.campaign.id),
    hasCampaignReply: p.campaignMembers.some((m) => m.repliedAt != null),
    lastActivityAt: lastActivityByPerson.get(p.id)?.createdAt ?? null,
    customValues: customValuesByPerson?.get(p.id) ?? {},
    contactsAtCompany: (p.companyId && contactsPerCompany?.get(p.companyId)) || 0,
  };
}

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
  { key: "owner", label: "Owner", icon: UserCircle },
  { key: "createdBy", label: "Created by", icon: UserCircle },
  { key: "company", label: "Company", icon: Building2 },
  { key: "phone", label: "Phones", icon: Phone },
  { key: "createdAt", label: "Creation date", icon: CalendarDays },
  { key: "jobTitle", label: "Job Title", icon: Briefcase },
  { key: "linkedin", label: "Linkedin", icon: Link2 },
  { key: "lastActivity", label: "Last activity", icon: History },
  { key: "nextActivity", label: "Next activity", icon: CalendarClock },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
] as const;

type StandardColumnKey = (typeof STANDARD_COLUMNS)[number]["key"];
type ColumnKey = StandardColumnKey | `custom:${string}`;

const DEFAULT_VISIBLE: ColumnKey[] = STANDARD_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "contacts:visibleColumns";
const WIDTH_STORAGE_KEY = "contacts:columnWidths";
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
// text. The colored circle stays for panels and kanban cards, where it's the only identifier.
function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  if (muted) {
    return (
      <div className="size-4 shrink-0 rounded flex items-center justify-center text-[9px] font-medium bg-muted text-subtle border border-border">
        {(initials(name) || "?")[0]}
      </div>
    );
  }
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

// Raw comparable value behind a column's displayed text — dates sort by
// timestamp, not by their "2h ago" rendering (which would sort alphabetically).
function sortValue(
  p: PersonRow,
  key: ColumnKey,
  lastActivityByPerson: Map<string, Activity>,
  nextTaskByPerson: Map<string, Task>
): number | string | null {
  if (key.startsWith("custom:")) return null;
  switch (key as StandardColumnKey) {
    case "email":
      return p.email ?? null;
    case "owner":
      return p.owner?.name ?? p.owner?.email ?? null;
    case "createdBy":
      return p.createdBy?.name ?? p.createdBy?.email ?? null;
    case "company":
      return p.company?.name ?? null;
    case "phone":
      return p.phone ?? null;
    case "createdAt":
      return p.createdAt.getTime();
    case "jobTitle":
      return p.jobTitle ?? null;
    case "linkedin":
      return p.linkedin ?? null;
    case "lastActivity": {
      const a = lastActivityByPerson.get(p.id);
      return a ? a.createdAt.getTime() : null;
    }
    case "nextActivity": {
      const t = nextTaskByPerson.get(p.id);
      return t?.dueAt ? t.dueAt.getTime() : null;
    }
    case "campaigns":
      return p.campaignMembers.map((m) => m.campaign.name).join(", ") || null;
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

export function ContactsView({
  people: initialPeople,
  lastActivityByPerson,
  nextTaskByPerson,
  tasksByPerson = new Map(),
  notesByPerson = new Map(),
  customFields,
  title = "People",
  onAddClick,
  users = [],
  stages = [],
  filterOptions,
  savedViews = [],
  initialView = null,
  currentUserId,
  customValuesByPerson,
  contactsPerCompany,
}: {
  people: PersonRow[];
  lastActivityByPerson: Map<string, Activity>;
  nextTaskByPerson: Map<string, Task>;
  tasksByPerson?: Map<string, Task[]>;
  notesByPerson?: Map<string, NoteWithAuthor[]>;
  customFields: PersonCustomField[];
  title?: string;
  onAddClick?: () => void;
  users?: WorkspaceUser[];
  stages?: ContactPipelineStage[];
  // Advanced filtering + saved views are only wired up on /contacts. Other hosts of this
  // component (e.g. a static List's detail page) omit these and keep the simple pickers.
  filterOptions?: ProspectFilterOptions;
  savedViews?: SavedView[];
  initialView?: SavedView | null;
  currentUserId?: string;
  customValuesByPerson?: Map<string, Record<string, string | null>>;
  contactsPerCompany?: Map<string, number>;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [view, setView] = useState<"list" | "kanban">("list");
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
  const viewMode = useViewMode();
  const linkBase = viewMode === "advanced" ? "/lead" : "/contacts";
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [changingOwner, setChangingOwner] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [previewPerson, setPreviewPerson] = useState<PersonRow | null>(null);
  const searchParams = useSearchParams();
  // Empty set = no filter applied (show everyone). "no-owner" is a synthetic id alongside real
  // user ids — OR semantics: a person matches if their owner is in this set. Seeded from
  // ?owner=<userId> so a link from the dashboard's "Ownership by agent" table lands pre-filtered.
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(() => {
    const fromUrl = searchParams.get("owner");
    return fromUrl ? new Set([fromUrl]) : new Set();
  });
  const [campaignFilter, setCampaignFilter] = useState<Set<string>>(new Set());

  // --- Advanced filters + saved views (only when filterOptions is supplied) ---
  const advanced = !!filterOptions;
  // Seeded once: a ?view=<id> link wins, otherwise fold the ?owner= deep link into the same
  // shape so the dashboard's "Ownership by agent" links keep working.
  const [filters, setFilters] = useState<ProspectFilters>(() => {
    if (initialView) return initialView.filters;
    const owner = searchParams.get("owner");
    return owner && owner !== NO_OWNER_KEY ? { ownerIds: [owner] } : {};
  });
  const [loadedView, setLoadedView] = useState<SavedView | null>(initialView);
  const [views, setViews] = useState<SavedView[]>(savedViews);
  const [savingView, setSavingView] = useState<"create" | null>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  // Unsaved-changes signal for the bottom bar: only when the current filters differ from
  // whatever view is loaded (an untouched saved view stays quiet).
  const dirty = advanced && !prospectFiltersEqual(filters, loadedView?.filters ?? {});
  const ownsLoadedView = !!loadedView && loadedView.createdById === currentUserId;

  const router = useRouter();

  function openView(view: SavedView | null) {
    setLoadedView(view);
    setFilters(view?.filters ?? {});
    setViewMenuOpen(false);
    // Keep the URL copyable — that link is how a view gets shared with a colleague.
    router.replace(view ? `/contacts?view=${view.id}` : "/contacts", { scroll: false });
  }

  function handleSaveView(name: string) {
    startTransition(async () => {
      const created = await createSavedView(name, filters);
      setViews((prev) => [...prev, created]);
      setLoadedView(created);
      setSavingView(null);
      router.replace(`/contacts?view=${created.id}`, { scroll: false });
    });
  }

  function handleUpdateView() {
    if (!loadedView) return;
    startTransition(async () => {
      await updateSavedViewFilters(loadedView.id, filters);
      const next = { ...loadedView, filters };
      setLoadedView(next);
      setViews((prev) => prev.map((v) => (v.id === next.id ? next : v)));
    });
  }

  function handleDeleteView(view: SavedView) {
    if (!confirm(`Delete the view "${view.name}"?`)) return;
    startTransition(async () => {
      await deleteSavedView(view.id);
      setViews((prev) => prev.filter((v) => v.id !== view.id));
      if (loadedView?.id === view.id) openView(null);
    });
  }

  const campaignOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const p of people) {
      for (const m of p.campaignMembers) byId.set(m.campaign.id, m.campaign);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  // `dir` set = the header menu picked a direction outright; otherwise cycle asc → desc → off.
  function handleSort(key: ColumnKey, dir?: SortDir) {
    setSort((prev) => {
      if (dir) return { key, dir };
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const filteredPeople = useMemo(() => {
    // Advanced mode evaluates the full ProspectFilters shape in memory (Contacts loads every
    // person, so kanban and sort keep working over the whole set). Elsewhere the two simple
    // pickers still apply.
    if (advanced) {
      if (!hasAnyFilter(filters)) return people;
      return people.filter((p) =>
        matchesProspectFilters(toMatchable(p, lastActivityByPerson, customValuesByPerson, contactsPerCompany), filters)
      );
    }
    return people.filter((p) => {
      if (ownerFilter.size > 0 && !ownerFilter.has(p.ownerId ?? NO_OWNER_KEY)) return false;
      if (campaignFilter.size > 0 && !p.campaignMembers.some((m) => campaignFilter.has(m.campaign.id))) return false;
      return true;
    });
  }, [
    people, ownerFilter, campaignFilter, advanced, filters,
    lastActivityByPerson, customValuesByPerson, contactsPerCompany,
  ]);

  const sortedPeople = useMemo(() => {
    if (!sort) return filteredPeople;
    const withValue = filteredPeople.map((p) => ({ p, v: sortValue(p, sort.key, lastActivityByPerson, nextTaskByPerson) }));
    withValue.sort((a, b) => compareValues(a.v, b.v, sort.dir));
    return withValue.map((x) => x.p);
  }, [filteredPeople, sort, lastActivityByPerson, nextTaskByPerson]);

  // Paging is client-side here on purpose: filters, sort and kanban all evaluate over the whole
  // set in memory, so slicing the query instead would filter within a page and give wrong results.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(DEFAULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(sortedPeople.length / perPage));
  // Filters shrinking the set can strand us past the last page.
  const safePage = Math.min(page, pageCount);
  const pagedPeople = useMemo(
    () => sortedPeople.slice((safePage - 1) * perPage, safePage * perPage),
    [sortedPeople, safePage, perPage]
  );

  function moveContact(id: string, stage: string) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)));
    startTransition(() => moveContactStage(id, stage));
  }

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

  function handleChangeOwner(ownerId: string | null) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      await setPersonOwners(ids, ownerId);
      setChangingOwner(false);
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Users size={14} strokeWidth={1.75} className="text-violet-400" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (onAddClick ? onAddClick() : setCreating(true))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            {onAddClick ? "Add People" : "New Person"}
          </button>
        </div>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="relative">
          <button
            onClick={() => advanced && setViewMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
          >
            <List size={14} strokeWidth={1.75} />
            {loadedView?.name ?? "All People"}
            <span className="text-subtle">
              · {sortedPeople.length}
              {sortedPeople.length !== people.length && ` of ${people.length}`}
            </span>
            {advanced && <ChevronDown size={13} strokeWidth={1.75} />}
          </button>

          {viewMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setViewMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-30 w-64 py-1 rounded-lg border border-border bg-surface shadow-xl">
                <button
                  onClick={() => openView(null)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left hover:bg-muted transition-colors"
                >
                  <Users size={13} strokeWidth={1.75} className="text-subtle" />
                  All People
                  {!loadedView && <Check size={13} strokeWidth={2} className="ml-auto text-accent" />}
                </button>

                {views.length > 0 && <div className="my-1 h-px bg-border" />}
                {views.map((v) => (
                  <div key={v.id} className="group flex items-center hover:bg-muted transition-colors">
                    <button
                      onClick={() => openView(v)}
                      className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 text-[13px] text-left"
                    >
                      <Eye size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                      <span className="truncate">{v.name}</span>
                      {loadedView?.id === v.id && <Check size={13} strokeWidth={2} className="ml-auto shrink-0 text-accent" />}
                    </button>
                    <button
                      onClick={() => handleDeleteView(v)}
                      className="px-2 py-1.5 text-subtle opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      title="Delete view"
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                ))}

                {/* A shared link opens someone else's view — it isn't in your list until you save it. */}
                {loadedView && !views.some((v) => v.id === loadedView.id) && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <p className="px-3 py-1.5 text-[11.5px] text-subtle">
                      Shared view — save it to keep it in your list.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

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

          {!advanced && (
            <>
              <OwnerFilterPicker users={users} selected={ownerFilter} onChange={setOwnerFilter} />
              <CampaignFilterPicker campaigns={campaignOptions} selected={campaignFilter} onChange={setCampaignFilter} />
            </>
          )}
          {/* Column visibility moved into the table header's "+" — see AddColumnButton. */}
        </div>
      </div>

      {advanced && (
        <div className="shrink-0 px-6 py-2 border-b border-border">
          <ProspectFilterBar
            options={filterOptions}
            filters={filters}
            onChange={setFilters}
            searchPlaceholder="Search name, email, job title, or company…"
            collapsible
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {view === "list" ? (
          <ListView
            people={pagedPeople}
            visibleColumns={visibleColumns}
            customFields={customFields}
            selected={selected}
            onSelectedChange={setSelected}
            onComposeEmail={(p) => setDraft({ personId: p.id, to: p.email ? [p.email] : [], contactFirstName: p.firstName })}
            onPreview={setPreviewPerson}
            lastActivityByPerson={lastActivityByPerson}
            nextTaskByPerson={nextTaskByPerson}
            customValuesByPerson={customValuesByPerson}
            sort={sort}
            onSort={handleSort}
            linkBase={linkBase}
            onAddRow={() => (onAddClick ? onAddClick() : setCreating(true))}
            onAddColumn={
              <AddColumnButton<ColumnKey>
                standardColumns={STANDARD_COLUMNS}
                customFields={customFields}
                visibleColumns={visibleColumns}
                onToggle={toggleColumn}
                customizeHref="/settings/data-model/person"
              />
            }
            onHideColumn={toggleColumn}
            onReorderColumn={reorderColumn}
            onResizeColumn={setColumnWidth}
            columnWidths={columnWidths}
          />
        ) : (
          <div className="p-6">
            <KanbanView
              people={filteredPeople}
              stages={stages}
              onMove={moveContact}
              linkBase={linkBase}
            />
          </div>
        )}
      </div>

      {view === "list" && (
        <div className="h-9 shrink-0 flex items-center justify-end gap-6 px-6 border-t border-border text-[12px] text-subtle">
          <span>Unique of Emails {sortedPeople.length}</span>
          <PaginationBar
            page={safePage}
            perPage={perPage}
            total={sortedPeople.length}
            label="leads"
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Shares the bulk bar's slot, so it yields while rows are selected. */}
      {dirty && selected.size === 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-xl border border-border bg-surface shadow-xl">
          <span className="text-[13px] px-2 text-subtle">
            {loadedView ? "Unsaved changes" : "Filtered view"}
          </span>
          <div className="w-px h-5 bg-border" />
          {ownsLoadedView && (
            <button
              onClick={handleUpdateView}
              disabled={pending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Check size={14} strokeWidth={1.75} />
              Update view
            </button>
          )}
          <button
            onClick={() => setSavingView("create")}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Eye size={14} strokeWidth={1.75} />
            {loadedView ? "Save as new view" : "Save this view"}
          </button>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => setFilters(loadedView?.filters ?? {})}
            className="p-1.5 rounded-lg text-subtle hover:bg-muted hover:text-foreground transition-colors"
            title={loadedView ? "Discard changes" : "Clear filters"}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {savingView && (
        <SaveViewDialog
          defaultName={loadedView ? `${loadedView.name} (copy)` : ""}
          pending={pending}
          onSave={handleSaveView}
          onClose={() => setSavingView(null)}
        />
      )}

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
          title={`Edit ${selected.size} contact${selected.size === 1 ? "" : "s"}`}
          fields={[
            { field: "stage", label: "Stage", options: stages.map((s) => s.label) },
            {
              field: "company:industry",
              label: "Company · Industry",
              options: INDUSTRIES,
              note: "Applies to each contact's company. Contacts with no company are skipped.",
            },
            {
              field: "company:country",
              label: "Company · Country",
              options: COUNTRIES,
              note: "Applies to each contact's company. Contacts with no company are skipped.",
            },
            {
              field: "company:revenueRange",
              label: "Company · Revenue Range",
              options: REVENUE_RANGES,
              note: "Applies to each contact's company. Contacts with no company are skipped.",
            },
            {
              field: "company:employeeCount",
              label: "Company · Employees",
              options: EMPLOYEE_BUCKETS.map((b) => b.label),
              note: "Applies to each contact's company. Contacts with no company are skipped.",
            },
          ]}
          onApply={async (field, value) => {
            const ids = [...selected];
            if (field.startsWith("company:")) {
              const res = await bulkUpdateCompanyForContacts(
                ids,
                field.slice("company:".length) as BulkCompanyField,
                value
              );
              setBulkNotice(
                res.skipped > 0
                  ? `Updated ${res.updated} compan${res.updated === 1 ? "y" : "ies"}. Skipped ${res.skipped} contact${res.skipped === 1 ? "" : "s"} with no company.`
                  : `Updated ${res.updated} compan${res.updated === 1 ? "y" : "ies"}.`
              );
            } else {
              const res = await bulkUpdatePersonField(ids, field as BulkPersonField, value);
              setBulkNotice(`Updated ${res.updated} contact${res.updated === 1 ? "" : "s"}.`);
            }
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
              Change owner for {selected.size} contact{selected.size === 1 ? "" : "s"}
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

      {creating && <CreateContactPanel onClose={() => setCreating(false)} />}
      {draft && <EmailComposer draft={draft} onClose={() => setDraft(null)} />}
      {previewPerson && (
        <ContactQuickPreview
          person={previewPerson}
          lastActivity={lastActivityByPerson.get(previewPerson.id)}
          nextTask={nextTaskByPerson.get(previewPerson.id)}
          tasks={tasksByPerson.get(previewPerson.id) ?? []}
          notes={notesByPerson.get(previewPerson.id) ?? []}
          users={users}
          linkBase={linkBase}
          onClose={() => setPreviewPerson(null)}
          onComposeEmail={(p) => {
            setPreviewPerson(null);
            setDraft({ personId: p.id, to: p.email ? [p.email] : [], contactFirstName: p.firstName });
          }}
        />
      )}
    </div>
  );
}

function cellValue(
  p: PersonRow,
  key: ColumnKey,
  lastActivityByPerson: Map<string, Activity>,
  nextTaskByPerson: Map<string, Task>,
  customValuesByPerson?: Map<string, Record<string, string | null>>
): string {
  if (key.startsWith("custom:")) {
    return customValuesByPerson?.get(p.id)?.[key.slice("custom:".length)] ?? "";
  }
  switch (key as StandardColumnKey) {
    case "email":
      return p.email ?? "";
    case "owner":
      return p.owner?.name ?? p.owner?.email ?? "";
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
    case "campaigns":
      return p.campaignMembers.map((m) => m.campaign.name).join(", ");
  }
}

function ListView({
  people,
  visibleColumns,
  customFields,
  selected,
  onSelectedChange,
  onComposeEmail,
  onPreview,
  lastActivityByPerson,
  nextTaskByPerson,
  customValuesByPerson,
  sort,
  onSort,
  linkBase = "/contacts",
  onAddRow,
  onAddColumn,
  onHideColumn,
  onReorderColumn,
  onResizeColumn,
  columnWidths,
}: {
  people: PersonRow[];
  visibleColumns: ColumnKey[];
  customFields: PersonCustomField[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onComposeEmail: (person: PersonRow) => void;
  onPreview: (person: PersonRow) => void;
  lastActivityByPerson: Map<string, Activity>;
  nextTaskByPerson: Map<string, Task>;
  customValuesByPerson?: Map<string, Record<string, string | null>>;
  sort: { key: ColumnKey; dir: SortDir } | null;
  onSort: (key: ColumnKey, dir?: SortDir) => void;
  linkBase?: string;
  onAddRow?: () => void;
  /** Rendered in the header's trailing cell — the "+" that adds a column. */
  onAddColumn?: React.ReactNode;
  onHideColumn?: (key: ColumnKey) => void;
  onReorderColumn?: (key: ColumnKey, before: ColumnKey) => void;
  onResizeColumn?: (key: ColumnKey, px: number) => void;
  columnWidths?: Record<string, number>;
}) {
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const cols = useColumnList<ColumnKey>(visibleColumns, STANDARD_COLUMNS, customFields);

  // Trailing column holds the "+" and absorbs leftover width, so the last real column keeps its
  // own edge instead of stretching across the viewport.
  const gridTemplate = `28px 24px 200px ${cols
    .map((c) => `${columnWidths?.[c.key] ?? DEFAULT_COL_WIDTH}px`)
    .join(" ")} minmax(36px, 1fr)`;
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
        className="grid pl-4 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <span className="flex items-center h-8">
          <input type="checkbox" className="size-3.5 rounded-sm accent-accent" checked={allSelected} onChange={toggleAll} />
        </span>
        <span />
        <span className="flex items-center gap-1.5 h-8 px-2 border-l border-border">
          <UserCircle size={13} strokeWidth={1.75} />
          Name
        </span>
        {cols.map((c) => (
          <ColumnHeader<ColumnKey>
            key={c.key}
            column={c}
            sort={sort}
            onSort={onSort}
            onHide={onHideColumn}
            onDropBefore={onReorderColumn}
            onResize={onResizeColumn}
            dragging={dragKey}
            onDragKeyChange={setDragKey}
          />
        ))}
        <span className="flex items-center h-8 px-1.5 border-l border-border">
          {onAddColumn}
        </span>
      </div>
      <div className="divide-y divide-border">
        {people.map((p) => {
          const name = fullName(p);
          return (
            <div
              key={p.id}
              className="grid pl-4 items-stretch hover:bg-muted/40 transition-colors group/row"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="flex items-center h-[33px]">
                <input
                  type="checkbox"
                  className="size-3.5 rounded-sm accent-accent"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                />
              </span>
              <button
                onClick={() => onPreview(p)}
                title="Quick preview"
                className="flex items-center justify-center text-subtle opacity-0 group-hover/row:opacity-100 hover:text-foreground transition-all"
              >
                <Eye size={13} strokeWidth={1.75} />
              </button>
              <Link
                href={`${linkBase}/${p.id}`}
                className="flex items-center gap-2 min-w-0 h-[33px] px-2 border-l border-border group"
              >
                {p.company?.domain ? (
                  <CompanyLogo
                    domain={p.company.domain}
                    fallbackText={(initials(name) || "?")[0]}
                    size={16}
                    rounded="rounded-full"
                    className="text-[9px]"
                  />
                ) : (
                  <Avatar name={name} muted />
                )}
                <p className="text-[13px] leading-tight truncate text-foreground group-hover:underline decoration-subtle underline-offset-2">
                  {name}
                </p>
              </Link>
              {cols.map((col) => (
                <span
                  key={col.key}
                  className="flex items-center text-[13px] text-subtle truncate h-[33px] px-2 border-l border-border"
                >
                  {col.key === "email" && p.email ? (
                    <button
                      onClick={() => onComposeEmail(p)}
                      title="Compose email"
                      className="truncate max-w-full text-left hover:text-accent transition-colors"
                    >
                      {p.email}
                    </button>
                  ) : col.key === "owner" || col.key === "createdBy" ? (
                    cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson, customValuesByPerson) && (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson, customValuesByPerson)} muted />
                        <span className="truncate">
                          {cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson, customValuesByPerson)}
                        </span>
                      </span>
                    )
                  ) : col.key === "company" && p.company ? (
                    <Link
                      href={`/companies/${p.company.id}`}
                      className="flex items-center gap-1.5 min-w-0 hover:text-foreground transition-colors"
                    >
                      <CompanyLogo
                        domain={p.company.domain}
                        fallbackText={(p.company.name || "?")[0].toUpperCase()}
                        size={16}
                        className="text-[9px]"
                      />
                      <span className="truncate">{p.company.name || "Untitled"}</span>
                    </Link>
                  ) : (
                    cellValue(p, col.key, lastActivityByPerson, nextTaskByPerson, customValuesByPerson) || "—"
                  )}
                </span>
              ))}
              <span className="border-l border-border" />
            </div>
          );
        })}
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

const OUTCOME_BADGE: Record<string, string> = {
  open: "bg-blue-500 text-white",
  won: "bg-emerald-500 text-white",
  lost: "bg-rose-500 text-white",
};

function KanbanView({
  people,
  stages,
  onMove,
  linkBase = "/contacts",
}: {
  people: PersonRow[];
  stages: ContactPipelineStage[];
  onMove: (id: string, stage: string) => void;
  linkBase?: string;
}) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [movingUnstaged, setMovingUnstaged] = useState(false);
  const [bulkPending, startBulkTransition] = useTransition();

  function handleBulkMove(targetLabel: string) {
    setMovingUnstaged(false);
    startBulkTransition(async () => {
      await bulkMoveUnstagedContacts(targetLabel);
      router.refresh();
    });
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-[13px] text-subtle">
          No stages defined yet —{" "}
          <Link href="/settings/contacts-pipeline" className="text-accent hover:underline">
            set up your contacts pipeline
          </Link>{" "}
          to group people by stage here.
        </p>
        <p className="text-[12px] text-subtle mt-1">{people.length} people, ungrouped for now.</p>
      </div>
    );
  }

  const unstaged = people.filter((p) => !p.stage || !stages.some((s) => s.label === p.stage));

  return (
    <div className="flex gap-4 items-start">
      {stages.map((stage) => {
        const items = people.filter((p) => p.stage === stage.label);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(stage.label);
            }}
            onDragLeave={() => setDragOver((s) => (s === stage.label ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/person-id");
              if (id) onMove(id, stage.label);
              setDragOver(null);
            }}
            className={`w-56 shrink-0 rounded-lg transition-colors ${dragOver === stage.label ? "bg-muted/60" : ""}`}
          >
            <div className="flex items-center gap-2 px-1 mb-2 pt-1">
              <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${OUTCOME_BADGE[stage.outcome] ?? "bg-muted"}`}>
                {stage.label}
              </span>
              <span className="text-[12px] text-subtle">{items.length}</span>
            </div>

            <div className="space-y-2 px-1 pb-2 min-h-8">
              {items.map((p) => {
                const name = fullName(p);
                const owner = p.owner?.name ?? p.owner?.email ?? "";
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/person-id", p.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="border border-border rounded-lg px-3 py-2.5 bg-surface cursor-grab active:cursor-grabbing space-y-1.5"
                  >
                    <Link href={`${linkBase}/${p.id}`} className="text-[13px] leading-tight truncate block hover:underline">
                      {name || "Untitled"}
                    </Link>
                    {p.company && (
                      <div className="flex items-center gap-1.5 text-[12px] text-subtle truncate">
                        <Building2 size={12} strokeWidth={1.75} className="shrink-0" />
                        <span className="truncate">{p.company.name}</span>
                      </div>
                    )}
                    {owner && (
                      <div className="flex items-center gap-1.5 text-[12px] text-subtle truncate">
                        <Avatar name={owner} />
                        <span className="truncate">{owner}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {unstaged.length > 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          className="w-56 shrink-0 rounded-lg"
        >
          <div className="flex items-center gap-2 px-1 mb-2 pt-1">
            <span className="px-2 py-0.5 rounded-full text-[12px] font-medium bg-muted text-subtle">No stage</span>
            <span className="text-[12px] text-subtle">{unstaged.length}</span>
          </div>

          <div className="px-1 mb-2 relative">
            <button
              onClick={() => setMovingUnstaged((v) => !v)}
              disabled={bulkPending}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-border text-[12px] text-subtle hover:text-foreground hover:border-subtle transition-colors disabled:opacity-50"
            >
              {bulkPending ? "Moving…" : "Move all to…"}
            </button>
            {movingUnstaged && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMovingUnstaged(false)} />
                <div className="absolute left-1 right-1 top-full mt-1 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-56 overflow-y-auto">
                  {stages.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleBulkMove(s.label)}
                      className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2 px-1 pb-2 min-h-8">
            {unstaged.map((p) => {
              const name = fullName(p);
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/person-id", p.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="border border-border rounded-lg px-3 py-2.5 bg-surface cursor-grab active:cursor-grabbing"
                >
                  <Link href={`${linkBase}/${p.id}`} className="text-[13px] leading-tight truncate block hover:underline">
                    {name || "Untitled"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
