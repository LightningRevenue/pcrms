"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import { SaveListDialog } from "@/components/save-list-dialog";
import {
  searchProspects,
  listAllProspectIds,
  saveProspectsAsList,
  addProspectsToCampaign,
} from "@/lib/actions/prospect-search";
import {
  PROSPECT_PAGE_SIZE,
  ENGAGEMENT_FILTERS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_HINTS,
  COLD_DAY_OPTIONS,
  type ProspectFilters,
  type CustomFieldFilter,
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

type Row = Awaited<ReturnType<typeof searchProspects>>["people"][number];

const toSet = (v?: string[]) => new Set(v ?? []);
const fromSet = (s: Set<string>) => (s.size ? [...s] : undefined);

export function LeadIntelligenceView({
  options,
  campaigns,
}: {
  options: ProspectFilterOptions;
  campaigns: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [seniority, setSeniority] = useState<Set<string>>(new Set());
  const [department, setDepartment] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Set<string>>(new Set());
  const [industry, setIndustry] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState<Set<string>>(new Set());
  const [revenueRange, setRevenueRange] = useState<Set<string>>(new Set());
  const [employeeBuckets, setEmployeeBuckets] = useState<Set<string>>(new Set());
  const [importBatches, setImportBatches] = useState<Set<string>>(new Set());
  const [campaignFilter, setCampaignFilter] = useState<Set<string>>(new Set());
  const [engagement, setEngagement] = useState<Set<string>>(new Set());
  const [coldDays, setColdDays] = useState(90);
  const [customFilters, setCustomFilters] = useState<Record<string, Set<string>>>({});
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [includeUnsubscribed, setIncludeUnsubscribed] = useState(false);
  const [savingList, setSavingList] = useState(false);

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filters: ProspectFilters = useMemo(() => {
    const customFields: CustomFieldFilter[] = Object.entries(customFilters)
      .filter(([, values]) => values.size > 0)
      .map(([definitionId, values]) => ({ definitionId, mode: "in" as const, values: [...values] }));

    return {
      q: q.trim() || undefined,
      seniority: fromSet(seniority),
      department: fromSet(department),
      stage: fromSet(stage),
      ownerIds: fromSet(owners),
      industry: fromSet(industry),
      country: fromSet(country),
      revenueRange: fromSet(revenueRange),
      employeeBuckets: fromSet(employeeBuckets),
      importBatchIds: fromSet(importBatches),
      campaignIds: fromSet(campaignFilter),
      engagement: fromSet(engagement) as ProspectFilters["engagement"],
      coldDays,
      hasEmail: hasEmail || undefined,
      hasPhone: hasPhone || undefined,
      includeUnsubscribed: includeUnsubscribed || undefined,
      customFields: customFields.length ? customFields : undefined,
    };
  }, [
    q, seniority, department, stage, owners, industry, country, revenueRange, employeeBuckets,
    importBatches, campaignFilter, engagement, coldDays, hasEmail, hasPhone, includeUnsubscribed, customFilters,
  ]);

  // Debounced so typing in the search box doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      startLoading(async () => {
        const res = await searchProspects({ ...filters, page });
        setRows(res.people);
        setTotal(res.total);
        setPageCount(res.pageCount);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [filters, page]);

  // Any filter change invalidates the current page and the selection built from it.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filters]);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    setSelected(next);
  }

  async function selectEveryMatch() {
    setBusy(true);
    try {
      const ids = await listAllProspectIds(filters);
      setSelected(new Set(ids));
      setNotice(`Selected all ${ids.length} matching contacts.`);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveList(name: string) {
    const res = await saveProspectsAsList(name, [...selected]);
    setNotice(`Saved "${name}" with ${res.added} contact${res.added === 1 ? "" : "s"}.`);
    setSelected(new Set());
  }

  async function onAddToCampaign(campaignId: string) {
    setBusy(true);
    try {
      const res = await addProspectsToCampaign(campaignId, [...selected]);
      setNotice(
        res.skipped > 0
          ? `Added ${res.added} contacts. Skipped ${res.skipped} (unsubscribed or not visible to you).`
          : `Added ${res.added} contacts to the campaign.`
      );
      setSelected(new Set());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not add to the campaign.");
    } finally {
      setBusy(false);
    }
  }

  const engagementOptions: FilterOption[] = ENGAGEMENT_FILTERS.map((k) => ({
    id: k,
    label: ENGAGEMENT_LABELS[k],
    hint: ENGAGEMENT_HINTS[k],
  }));

  const activeCount =
    seniority.size + department.size + stage.size + owners.size + industry.size + country.size +
    revenueRange.size + employeeBuckets.size + importBatches.size + campaignFilter.size +
    engagement.size + Object.values(customFilters).reduce((n, s) => n + s.size, 0) +
    (hasEmail ? 1 : 0) + (hasPhone ? 1 : 0) + (includeUnsubscribed ? 1 : 0) + (q.trim() ? 1 : 0);

  function clearAll() {
    setQ("");
    [setSeniority, setDepartment, setStage, setOwners, setIndustry, setCountry, setRevenueRange,
     setEmployeeBuckets, setImportBatches, setCampaignFilter, setEngagement].forEach((s) => s(new Set()));
    setCustomFilters({});
    setHasEmail(false);
    setHasPhone(false);
    setIncludeUnsubscribed(false);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 pt-5 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Lead Intelligence</h1>
            <p className="text-[12.5px] text-subtle mt-0.5">
              Search the contacts you already have, then push them into a campaign.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-semibold tabular-nums">{loading ? "…" : total.toLocaleString()}</p>
            <p className="text-[11px] text-subtle uppercase tracking-wide">contacts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, job title, or company…"
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] rounded-md border border-border bg-transparent outline-none focus:border-accent"
            />
          </div>
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1 text-[12px] text-subtle hover:text-foreground transition-colors"
            >
              <X size={12} strokeWidth={2} /> Clear {activeCount}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <FilterPicker label="Seniority" icon={Target} options={options.seniority} selected={seniority} onChange={setSeniority} />
          <FilterPicker label="Department" icon={Layers} options={options.department} selected={department} onChange={setDepartment} />
          <FilterPicker label="Industry" icon={Briefcase} options={options.industry} selected={industry} onChange={setIndustry} />
          <FilterPicker label="Employees" icon={Users} options={options.employeeBuckets} selected={employeeBuckets} onChange={setEmployeeBuckets} />
          <FilterPicker label="Revenue" icon={Banknote} options={options.revenueRange} selected={revenueRange} onChange={setRevenueRange} />
          <FilterPicker label="Country" icon={Globe2} options={options.country} selected={country} onChange={setCountry} />
          <FilterPicker label="Stage" icon={Building2} options={options.stage} selected={stage} onChange={setStage} emptyText="No contact stages defined yet." />
          <FilterPicker label="Owner" icon={UserCircle} options={options.owners} selected={owners} onChange={setOwners} />
          <FilterPicker label="Source" icon={Upload} options={options.importBatches} selected={importBatches} onChange={setImportBatches} emptyText="No imports yet." />
          <FilterPicker label="Campaign" icon={Megaphone} options={options.campaigns} selected={campaignFilter} onChange={setCampaignFilter} emptyText="No campaigns yet." />
          <FilterPicker label="Engagement" icon={MailCheck} options={engagementOptions} selected={engagement} onChange={setEngagement} width="w-72" />

          {engagement.has("cold") && (
            <select
              value={coldDays}
              onChange={(e) => setColdDays(Number(e.target.value))}
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
                selected={customFilters[f.id] ?? new Set()}
                onChange={(next) => setCustomFilters((prev) => ({ ...prev, [f.id]: next }))}
              />
            ))}

          <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
            <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} />
            Has email
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
            <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} />
            Has phone
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-subtle cursor-pointer">
            <input
              type="checkbox"
              checked={includeUnsubscribed}
              onChange={(e) => setIncludeUnsubscribed(e.target.checked)}
            />
            Include unsubscribed
          </label>
        </div>
      </header>

      {(selected.size > 0 || notice) && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-muted/40">
          {selected.size > 0 ? (
            <>
              <span className="text-[12.5px] font-medium">{selected.size} selected</span>
              {selected.size < total && (
                <button onClick={selectEveryMatch} disabled={busy} className="text-[12px] text-accent hover:underline">
                  Select all {total.toLocaleString()}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSavingList(true)}
                  disabled={busy}
                  className="px-2.5 py-1 text-[12.5px] rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Save as list
                </button>
                <select
                  disabled={busy || campaigns.length === 0}
                  defaultValue=""
                  onChange={(e) => e.target.value && onAddToCampaign(e.target.value)}
                  className="px-2.5 py-1 text-[12.5px] rounded-md border border-accent text-accent bg-accent/10 outline-none disabled:opacity-50"
                >
                  <option value="">Add to campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <span className="text-[12.5px] text-subtle">{notice}</span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-surface border-b border-border z-10">
            <tr className="text-left text-subtle">
              <th className="w-9 px-3 py-2">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
              </th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Industry</th>
              <th className="px-3 py-2 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      setSelected(next);
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/lead/${p.id}`} className="hover:text-accent transition-colors">
                    {[p.firstName, p.lastName].filter(Boolean).join(" ")}
                  </Link>
                  {p.email && <span className="block text-[11.5px] text-subtle truncate">{p.email}</span>}
                </td>
                <td className="px-3 py-2 text-subtle">{p.jobTitle ?? "—"}</td>
                <td className="px-3 py-2 text-subtle">{p.phone || "—"}</td>
                <td className="px-3 py-2">
                  {p.company ? (
                    <Link href={`/companies/${p.company.id}`} className="hover:text-accent transition-colors">
                      {p.company.name}
                    </Link>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                  {p.company && p.company._count.people > 1 && (
                    <span className="text-[11px] text-subtle"> · {p.company._count.people} contacts</span>
                  )}
                </td>
                <td className="px-3 py-2 text-subtle">{p.company?.industry ?? "—"}</td>
                <td className="px-3 py-2 text-subtle">{p.owner?.name ?? p.owner?.email ?? "Unowned"}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-subtle">
                  No contacts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <footer className="flex items-center justify-between px-6 py-2 border-t border-border text-[12.5px]">
          <span className="text-subtle">
            {(page - 1) * PROSPECT_PAGE_SIZE + 1}–{Math.min(page * PROSPECT_PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <span className="text-subtle">Page {page} of {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </footer>
      )}

      {savingList && (
        <SaveListDialog
          count={selected.size}
          onSave={onSaveList}
          onClose={() => setSavingList(false)}
        />
      )}
    </div>
  );
}
