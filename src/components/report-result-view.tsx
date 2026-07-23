"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import type { ReportResult, Display } from "@/lib/actions/custom-reports";
import { getCustomReportRows, type DrillDownRow } from "@/lib/actions/custom-reports";
import type { ReportEntity, CustomReportFilter } from "@/lib/custom-report-registry";

export function ReportResultView({
  result,
  display,
  loading,
  groupBy,
}: {
  result: ReportResult | null;
  display: Display;
  loading: boolean;
  groupBy: string | null;
}) {
  if (loading && !result) {
    return <div className="h-32 rounded bg-muted animate-pulse" />;
  }
  if (!result) return null;

  if (!groupBy || result.groups === null) {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-3xl font-semibold tabular-nums">{result.total.toLocaleString()}</p>
      </div>
    );
  }

  if (result.groups.length === 0) {
    return <p className="text-[13px] text-subtle py-6 text-center border border-dashed border-border rounded-md">No matching rows.</p>;
  }

  if (display === "table") {
    return (
      <div className="border border-border rounded-md overflow-hidden">
        {result.groups.map((g) => (
          <div key={g.rawValue} className="flex items-center justify-between px-4 py-2 text-[13px] border-b border-border last:border-b-0">
            <span className="truncate">{g.label}</span>
            <span className="tabular-nums text-subtle">{g.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  // bar and line both render as simple horizontal bars here — a "line" for a categorical
  // group-by (owner/stage/enum) doesn't mean anything different from a bar; a true time
  // series would need groupBy to bucket by day/week, which the date fields already do via
  // bucketKey's day-granularity, so this reads fine as bars in both cases.
  const max = Math.max(1, ...result.groups.map((g) => g.value));
  return (
    <div className="space-y-2">
      {result.groups.map((g) => (
        <div key={g.rawValue} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-[13px] truncate">{g.label}</span>
          <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${Math.max(4, (g.value / max) * 100)}%` }} />
          </div>
          <span className="w-12 shrink-0 text-[12px] text-subtle text-right tabular-nums">{g.value}</span>
        </div>
      ))}
    </div>
  );
}

// Wraps ReportResultView with click-to-drill-down — used on the saved-report view page
// (not the live builder preview, where the definition is still changing).
export function ReportResultViewWithDrilldown({
  result,
  display,
  entity,
  filters,
  groupBy,
}: {
  result: ReportResult;
  display: Display;
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string | null;
}) {
  const [activeGroup, setActiveGroup] = useState<{ label: string; rawValue: string } | null>(null);

  if (!groupBy || result.groups === null) {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-3xl font-semibold tabular-nums">{result.total.toLocaleString()}</p>
      </div>
    );
  }

  if (result.groups.length === 0) {
    return <p className="text-[13px] text-subtle py-6 text-center border border-dashed border-border rounded-md">No matching rows.</p>;
  }

  const max = Math.max(1, ...result.groups.map((g) => g.value));

  return (
    <>
      {display === "table" ? (
        <div className="border border-border rounded-md overflow-hidden">
          {result.groups.map((g) => (
            <button
              key={g.rawValue}
              onClick={() => setActiveGroup(g)}
              className="w-full flex items-center justify-between px-4 py-2 text-[13px] border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors text-left"
            >
              <span className="truncate">{g.label}</span>
              <span className="tabular-nums text-subtle">{g.value.toLocaleString()}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {result.groups.map((g) => (
            <button key={g.rawValue} onClick={() => setActiveGroup(g)} className="w-full flex items-center gap-3 group">
              <span className="w-28 shrink-0 text-[13px] text-left truncate">{g.label}</span>
              <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                <div className="h-full bg-accent group-hover:opacity-80 transition-opacity" style={{ width: `${Math.max(4, (g.value / max) * 100)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-[12px] text-subtle text-right tabular-nums">{g.value}</span>
            </button>
          ))}
        </div>
      )}

      {activeGroup !== null && (
        <GroupDrilldownPanel
          entity={entity}
          filters={filters}
          groupBy={groupBy}
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
        />
      )}
    </>
  );
}

function GroupDrilldownPanel({
  entity,
  filters,
  groupBy,
  group,
  onClose,
}: {
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string;
  group: { label: string; rawValue: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DrillDownRow[] | null>(null);

  useEffect(() => {
    getCustomReportRows({ entity, filters, groupBy, groupValue: group.rawValue }).then(setRows);
  }, [entity, filters, groupBy, group.rawValue]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <p className="text-[13px] font-medium truncate">{group.label}</p>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="text-[13px] text-subtle text-center py-10">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-10">Nothing here.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <Link key={r.id} href={r.href} className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-[13px] truncate">{r.title}</p>
                    <p className="text-[12px] text-subtle truncate mt-0.5">{r.subtitle}</p>
                  </div>
                  <ArrowUpRight size={13} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
