"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { SaveListDialog } from "@/components/save-list-dialog";
import {
  ProspectFilterBar,
  countActiveFilters,
  type ProspectFilterOptions,
} from "@/components/prospect-filter-bar";
import {
  searchProspects,
  listAllProspectIds,
  saveProspectsAsList,
  addProspectsToCampaign,
} from "@/lib/actions/prospect-search";
import { PROSPECT_PAGE_SIZE, type ProspectFilters } from "@/lib/prospect-filters";

export type { ProspectFilterOptions };

type Row = Awaited<ReturnType<typeof searchProspects>>["people"][number];

export function LeadIntelligenceView({
  options,
  campaigns,
}: {
  options: ProspectFilterOptions;
  campaigns: { id: string; name: string }[];
}) {
  const [filters, setFilters] = useState<ProspectFilters>({});
  const [savingList, setSavingList] = useState(false);

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

        <ProspectFilterBar options={options} filters={filters} onChange={setFilters} />
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
