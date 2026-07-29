"use client";

import {
  Search,
  Users,
  Building2,
  Briefcase,
  Globe2,
  Banknote,
  UserCircle,
  Upload,
  Megaphone,
  Target,
  MailCheck,
  Layers,
  X,
} from "lucide-react";
import { FilterPicker, type FilterOption } from "@/components/filter-picker";
import {
  ENGAGEMENT_FILTERS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_HINTS,
  COLD_DAY_OPTIONS,
  type ProspectFilters,
} from "@/lib/prospect-filters";

type CustomFieldDef = { id: string; label: string; type: string; options: string[] };

export type ProspectFilterOptions = {
  seniority: FilterOption[];
  department: FilterOption[];
  stage: FilterOption[];
  industry: FilterOption[];
  country: FilterOption[];
  revenueRange: FilterOption[];
  employeeBuckets: FilterOption[];
  owners: FilterOption[];
  importBatches: FilterOption[];
  campaigns: FilterOption[];
  customFields: CustomFieldDef[];
};

const toSet = (v?: string[]) => new Set(v ?? []);
const fromSet = (s: Set<string>) => (s.size ? [...s] : undefined);

/** Number of active filters, for the "Clear N" affordance. */
export function countActiveFilters(f: ProspectFilters) {
  return (
    (f.q?.trim() ? 1 : 0) +
    (f.seniority?.length ?? 0) +
    (f.department?.length ?? 0) +
    (f.stage?.length ?? 0) +
    (f.ownerIds?.length ?? 0) +
    (f.noOwner ? 1 : 0) +
    (f.industry?.length ?? 0) +
    (f.country?.length ?? 0) +
    (f.revenueRange?.length ?? 0) +
    (f.employeeBuckets?.length ?? 0) +
    (f.importBatchIds?.length ?? 0) +
    (f.campaignIds?.length ?? 0) +
    (f.engagement?.length ?? 0) +
    (f.customFields?.reduce((n, cf) => n + cf.values.length, 0) ?? 0) +
    (f.hasEmail ? 1 : 0) +
    (f.hasPhone ? 1 : 0) +
    (f.includeUnsubscribed ? 1 : 0)
  );
}

// The full prospect filter toolbar, shared by Lead Intelligence and Contacts. Controlled:
// the whole ProspectFilters object lives in the parent, so a saved view can be loaded into it
// and compared against it. `page` is the caller's concern and is never touched here.
export function ProspectFilterBar({
  options,
  filters,
  onChange,
  showSearch = true,
  searchPlaceholder = "Name, email, job title, or company…",
}: {
  options: ProspectFilterOptions;
  filters: ProspectFilters;
  onChange: (next: ProspectFilters) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
}) {
  const patch = (p: Partial<ProspectFilters>) => onChange({ ...filters, ...p });

  const engagement = toSet(filters.engagement);
  const customSelected = (definitionId: string) =>
    toSet(filters.customFields?.find((cf) => cf.definitionId === definitionId)?.values);

  function setCustom(definitionId: string, next: Set<string>) {
    const others = (filters.customFields ?? []).filter((cf) => cf.definitionId !== definitionId);
    const merged = next.size ? [...others, { definitionId, mode: "in" as const, values: [...next] }] : others;
    patch({ customFields: merged.length ? merged : undefined });
  }

  const engagementOptions: FilterOption[] = ENGAGEMENT_FILTERS.map((k) => ({
    id: k,
    label: ENGAGEMENT_LABELS[k],
    hint: ENGAGEMENT_HINTS[k],
  }));

  const activeCount = countActiveFilters(filters);

  return (
    <>
      {showSearch && (
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" strokeWidth={1.75} />
            <input
              value={filters.q ?? ""}
              onChange={(e) => patch({ q: e.target.value || undefined })}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] rounded-md border border-border bg-transparent outline-none focus:border-accent"
            />
          </div>
          {activeCount > 0 && (
            <button
              onClick={() => onChange({})}
              className="flex items-center gap-1 px-2 py-1 text-[12px] text-subtle hover:text-foreground transition-colors"
            >
              <X size={12} strokeWidth={2} /> Clear {activeCount}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <FilterPicker label="Seniority" icon={Target} options={options.seniority} selected={toSet(filters.seniority)} onChange={(s) => patch({ seniority: fromSet(s) })} />
        <FilterPicker label="Department" icon={Layers} options={options.department} selected={toSet(filters.department)} onChange={(s) => patch({ department: fromSet(s) })} />
        <FilterPicker label="Industry" icon={Briefcase} options={options.industry} selected={toSet(filters.industry)} onChange={(s) => patch({ industry: fromSet(s) })} />
        <FilterPicker label="Employees" icon={Users} options={options.employeeBuckets} selected={toSet(filters.employeeBuckets)} onChange={(s) => patch({ employeeBuckets: fromSet(s) })} />
        <FilterPicker label="Revenue" icon={Banknote} options={options.revenueRange} selected={toSet(filters.revenueRange)} onChange={(s) => patch({ revenueRange: fromSet(s) })} />
        <FilterPicker label="Country" icon={Globe2} options={options.country} selected={toSet(filters.country)} onChange={(s) => patch({ country: fromSet(s) })} />
        <FilterPicker label="Stage" icon={Building2} options={options.stage} selected={toSet(filters.stage)} onChange={(s) => patch({ stage: fromSet(s) })} emptyText="No contact stages defined yet." />
        <FilterPicker label="Owner" icon={UserCircle} options={options.owners} selected={toSet(filters.ownerIds)} onChange={(s) => patch({ ownerIds: fromSet(s) })} />
        <FilterPicker label="Source" icon={Upload} options={options.importBatches} selected={toSet(filters.importBatchIds)} onChange={(s) => patch({ importBatchIds: fromSet(s) })} emptyText="No imports yet." />
        <FilterPicker label="Campaign" icon={Megaphone} options={options.campaigns} selected={toSet(filters.campaignIds)} onChange={(s) => patch({ campaignIds: fromSet(s) })} emptyText="No campaigns yet." />
        <FilterPicker
          label="Engagement"
          icon={MailCheck}
          options={engagementOptions}
          selected={engagement}
          onChange={(s) => patch({ engagement: fromSet(s) as ProspectFilters["engagement"] })}
          width="w-72"
        />

        {engagement.has("cold") && (
          <select
            value={filters.coldDays ?? 90}
            onChange={(e) => patch({ coldDays: Number(e.target.value) })}
            className="px-2 py-1 text-[12.5px] rounded-md border border-border bg-transparent outline-none focus:border-accent"
          >
            {COLD_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}+ days quiet</option>
            ))}
          </select>
        )}

        {options.customFields
          .filter((f) => f.type === "SELECT" && f.options.length > 0)
          .map((f) => (
            <FilterPicker
              key={f.id}
              label={f.label}
              options={f.options.map((o) => ({ id: o, label: o }))}
              selected={customSelected(f.id)}
              onChange={(next) => setCustom(f.id, next)}
            />
          ))}

        <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
          <input type="checkbox" checked={!!filters.hasEmail} onChange={(e) => patch({ hasEmail: e.target.checked || undefined })} />
          Has email
        </label>
        <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
          <input type="checkbox" checked={!!filters.hasPhone} onChange={(e) => patch({ hasPhone: e.target.checked || undefined })} />
          Has phone
        </label>
        <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.includeUnsubscribed}
            onChange={(e) => patch({ includeUnsubscribed: e.target.checked || undefined })}
          />
          Include unsubscribed
        </label>
      </div>
    </>
  );
}
