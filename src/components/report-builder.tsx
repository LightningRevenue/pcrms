"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Trash2, Table2, BarChart3, LineChart, PieChart } from "lucide-react";
import {
  ENTITY_REGISTRY,
  getEntityDef,
  getFieldDef,
  DATE_FILTER_LABELS,
  type ReportEntity,
  type CustomReportFilter,
  type DateFilterOp,
} from "@/lib/custom-report-registry";
import {
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  runCustomReport,
  type Aggregate,
  type Display,
  type DateGranularity,
  type ReportResult,
} from "@/lib/actions/custom-reports";
import { ReportResultView } from "@/components/report-result-view";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

const ENTITY_OPTIONS = Object.entries(ENTITY_REGISTRY) as [ReportEntity, (typeof ENTITY_REGISTRY)[ReportEntity]][];

export function ReportBuilder({
  users,
  existing,
  onSave,
  onDelete,
}: {
  users: WorkspaceUser[];
  existing?: {
    id: string;
    name: string;
    entity: ReportEntity;
    filters: CustomReportFilter[];
    groupBy: string | null;
    aggregate: Aggregate;
    display: Display;
    dateGranularity?: DateGranularity;
  };
  // Embedded mode (e.g. inside a dashboard-widget modal): when provided, save/delete call these
  // instead of the standalone-report actions + router navigation, and the "back to dashboards"
  // link is hidden since the builder isn't a full page in that context.
  onSave?: (input: {
    name: string;
    entity: ReportEntity;
    filters: CustomReportFilter[];
    groupBy: string | null;
    aggregate: Aggregate;
    display: Display;
    dateGranularity: DateGranularity;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [entity, setEntity] = useState<ReportEntity>(existing?.entity ?? "person");
  const [filters, setFilters] = useState<CustomReportFilter[]>(existing?.filters ?? []);
  const [groupBy, setGroupBy] = useState<string | null>(existing?.groupBy ?? null);
  const [aggregate, setAggregate] = useState<Aggregate>(existing?.aggregate ?? "count");
  const [display, setDisplay] = useState<Display>(existing?.display ?? "table");
  const [dateGranularity, setDateGranularity] = useState<DateGranularity>(existing?.dateGranularity ?? "day");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saving, startSaving] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const entityDef = getEntityDef(entity);
  const filterableFields = entityDef.fields.filter((f) => f.filterable);
  const groupableFields = entityDef.fields.filter((f) => f.groupable);

  function changeEntity(next: ReportEntity) {
    setEntity(next);
    setFilters([]);
    setGroupBy(null);
    setDateGranularity("day");
    if (aggregate === "sum_value" && !ENTITY_REGISTRY[next].supportsSumValue) setAggregate("count");
  }

  function changeGroupBy(nextKey: string | null) {
    setGroupBy(nextKey);
    const nextDef = nextKey ? getFieldDef(entity, nextKey) : undefined;
    if (nextDef?.kind !== "date") setDateGranularity("day");
    // Line only makes sense for a date groupBy, pie only for a categorical one — reset display
    // to table when the current choice no longer fits the new groupBy.
    if (display === "line" && nextDef?.kind !== "date") setDisplay("table");
    if (display === "pie" && nextDef?.kind === "date") setDisplay("table");
  }

  function addFilter(fieldKey: string) {
    const def = getFieldDef(entity, fieldKey);
    if (!def) return;
    if (def.kind === "date") {
      setFilters((prev) => [...prev, { field: fieldKey, kind: "date", op: "last_30_days" }]);
    } else if (def.kind === "owner") {
      setFilters((prev) => [...prev, { field: fieldKey, kind: "owner", values: users[0] ? [users[0].id] : ["unowned"] }]);
    } else if (def.kind === "boolean") {
      setFilters((prev) => [...prev, { field: fieldKey, kind: "boolean", value: def.options?.[0]?.value ?? "true" }]);
    } else {
      setFilters((prev) => [...prev, { field: fieldKey, kind: def.kind === "enum" ? "enum" : "string", value: def.options?.[0]?.value ?? "" }]);
    }
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFilterValue(index: number, patch: Partial<CustomReportFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? ({ ...f, ...patch } as CustomReportFilter) : f)));
  }

  const reportInput = useMemo(
    () => ({ entity, filters, groupBy, aggregate, dateGranularity }),
    [entity, filters, groupBy, aggregate, dateGranularity]
  );

  useEffect(() => {
    startPreview(async () => {
      try {
        setResult(await runCustomReport(reportInput));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run report");
      }
    });
  }, [reportInput]);

  function handleSave() {
    setError(null);
    startSaving(async () => {
      try {
        const input = { name, entity, filters, groupBy, aggregate, display, dateGranularity };
        if (onSave) {
          await onSave(input);
          return;
        }
        if (existing) {
          await updateCustomReport(existing.id, input);
          router.push(`/dashboards/report/${existing.id}`);
        } else {
          const created = await createCustomReport(input);
          router.push(`/dashboards/report/${created.id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleDelete() {
    if (!existing) return;
    if (!confirm(`Delete "${existing.name}"?`)) return;
    startSaving(async () => {
      if (onDelete) {
        await onDelete();
        return;
      }
      await deleteCustomReport(existing.id);
      router.push("/dashboards");
    });
  }

  const embedded = onSave !== undefined;

  return (
    <div className={embedded ? "" : "px-8 py-10 max-w-3xl"}>
      {!embedded && (
        <Link href="/dashboards" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <ArrowLeft size={14} strokeWidth={1.75} />
          Dashboards
        </Link>
      )}

      <div className={`flex items-center justify-between ${embedded ? "" : "mt-4"}`}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Report name"
          className="text-xl font-medium bg-transparent outline-none border-b border-transparent hover:border-border focus:border-accent transition-colors"
        />
        {existing && (
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={13} strokeWidth={1.75} />
            Delete
          </button>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {/* Step 1: entity */}
        <div>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">1. What are you reporting on?</p>
          <div className="grid grid-cols-3 gap-2">
            {ENTITY_OPTIONS.map(([key, def]) => (
              <button
                key={key}
                onClick={() => changeEntity(key)}
                className={`px-3 py-2 rounded-md border text-[13px] text-left transition-colors ${
                  entity === key ? "border-accent bg-accent/5 text-accent" : "border-border hover:border-subtle"
                }`}
              >
                {def.labelPlural}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: filters */}
        <div>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">2. Filter</p>
          <div className="space-y-2">
            {filters.map((filter, i) => (
              <FilterRow
                key={i}
                filter={filter}
                entity={entity}
                users={users}
                onChange={(patch) => updateFilterValue(i, patch)}
                onRemove={() => removeFilter(i)}
              />
            ))}
          </div>
          {filterableFields.length > 0 && (
            <div className="relative mt-2">
              <AddFilterMenu fields={filterableFields} usedFields={filters.map((f) => f.field)} onAdd={addFilter} />
            </div>
          )}
        </div>

        {/* Step 3: group + aggregate */}
        <div>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">3. Group &amp; count</p>
          <div className="flex items-center gap-3">
            <select
              value={groupBy ?? ""}
              onChange={(e) => changeGroupBy(e.target.value || null)}
              className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
            >
              <option value="" className="bg-background text-foreground">No grouping (single total)</option>
              {groupableFields.map((f) => (
                <option key={f.key} value={f.key} className="bg-background text-foreground">
                  Group by {f.label}
                </option>
              ))}
            </select>

            {groupBy && getFieldDef(entity, groupBy)?.kind === "date" && (
              <select
                value={dateGranularity}
                onChange={(e) => setDateGranularity(e.target.value as DateGranularity)}
                className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                <option value="day" className="bg-background text-foreground">By day</option>
                <option value="week" className="bg-background text-foreground">By week</option>
                <option value="month" className="bg-background text-foreground">By month</option>
                <option value="year" className="bg-background text-foreground">By year</option>
              </select>
            )}

            {entityDef.supportsSumValue && (
              <select
                value={aggregate}
                onChange={(e) => setAggregate(e.target.value as Aggregate)}
                className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                <option value="count" className="bg-background text-foreground">Count</option>
                <option value="sum_value" className="bg-background text-foreground">Sum of deal value</option>
              </select>
            )}
          </div>
        </div>

        {/* Step 4: display */}
        <div>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">4. Display as</p>
          <div className="flex items-center gap-2">
            {(() => {
              const groupByKind = groupBy ? getFieldDef(entity, groupBy)?.kind : undefined;
              const isDateGroup = groupByKind === "date";
              return (
                [
                  { key: "table" as Display, label: "Table", icon: Table2, disabled: false },
                  { key: "bar" as Display, label: "Bar chart", icon: BarChart3, disabled: !groupBy },
                  { key: "line" as Display, label: "Line", icon: LineChart, disabled: !isDateGroup },
                  { key: "pie" as Display, label: "Pie chart", icon: PieChart, disabled: !groupBy || isDateGroup },
                ]
              );
            })().map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDisplay(opt.key)}
                disabled={opt.disabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  display === opt.key ? "border-accent bg-accent/5 text-accent" : "border-border hover:border-subtle"
                }`}
              >
                <opt.icon size={14} strokeWidth={1.75} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="border-t border-border pt-6">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">Preview</p>
          <ReportResultView result={result} display={display} loading={previewing} groupBy={groupBy} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Save changes" : "Create report"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterRow({
  filter,
  entity,
  users,
  onChange,
  onRemove,
}: {
  filter: CustomReportFilter;
  entity: ReportEntity;
  users: WorkspaceUser[];
  onChange: (patch: Partial<CustomReportFilter>) => void;
  onRemove: () => void;
}) {
  const def = getFieldDef(entity, filter.field);
  if (!def) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-[13px]">
      <span className="text-subtle w-32 shrink-0">{def.label}</span>

      {filter.kind === "date" && (
        <div className="flex-1 flex items-center gap-2">
          <select
            value={filter.op}
            onChange={(e) => onChange({ op: e.target.value as DateFilterOp })}
            className="bg-transparent outline-none"
          >
            {(Object.entries(DATE_FILTER_LABELS) as [DateFilterOp, string][]).map(([value, label]) => (
              <option key={value} value={value} className="bg-background text-foreground">
                {label}
              </option>
            ))}
          </select>
          {filter.op === "custom" && (
            <>
              <input
                type="date"
                value={filter.start ?? ""}
                onChange={(e) => onChange({ start: e.target.value })}
                className="bg-transparent outline-none border-b border-border text-[12px]"
              />
              <span className="text-subtle">–</span>
              <input
                type="date"
                value={filter.end ?? ""}
                onChange={(e) => onChange({ end: e.target.value })}
                className="bg-transparent outline-none border-b border-border text-[12px]"
              />
            </>
          )}
        </div>
      )}

      {filter.kind === "owner" && (
        <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.values.includes("unowned")}
              onChange={(e) =>
                onChange({ values: e.target.checked ? [...filter.values, "unowned"] : filter.values.filter((v) => v !== "unowned") })
              }
            />
            No owner
          </label>
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.values.includes(u.id)}
                onChange={(e) =>
                  onChange({ values: e.target.checked ? [...filter.values, u.id] : filter.values.filter((v) => v !== u.id) })
                }
              />
              {u.name ?? u.email}
            </label>
          ))}
        </div>
      )}

      {(filter.kind === "enum" || filter.kind === "boolean") && def.options && (
        <select value={filter.value} onChange={(e) => onChange({ value: e.target.value })} className="flex-1 bg-transparent outline-none">
          {def.options.map((o) => (
            <option key={o.value} value={o.value} className="bg-background text-foreground">
              {o.label}
            </option>
          ))}
        </select>
      )}

      {filter.kind === "string" && (
        <input
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 bg-transparent outline-none border-b border-border"
        />
      )}

      <button onClick={onRemove} className="text-subtle hover:text-foreground transition-colors shrink-0">
        <X size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function AddFilterMenu({
  fields,
  usedFields,
  onAdd,
}: {
  fields: { key: string; label: string }[];
  usedFields: string[];
  onAdd: (fieldKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = fields.filter((f) => !usedFields.includes(f.key));

  if (available.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
      >
        <Plus size={14} strokeWidth={1.75} />
        Add filter
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-48 border border-border rounded-lg bg-surface shadow-lg z-20 py-1">
            {available.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  onAdd(f.key);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
