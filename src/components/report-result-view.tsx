"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import type { ReportResult, Display, ReportGroupRow } from "@/lib/actions/custom-reports";
import { getCustomReportRows, type DrillDownRow } from "@/lib/actions/custom-reports";
import type { ReportEntity, CustomReportFilter } from "@/lib/custom-report-registry";

// Small fixed palette for the pie chart — this app has no multi-color chart system yet (just
// a single --accent), so a hardcoded handful of hex values is simpler than building one for
// this single use site.
const PIE_COLORS = ["#4d7c5f", "#b08968", "#5c7cae", "#a35c7c", "#8a9a5b", "#c98a3c", "#7c6bab", "#4a9d9c"];

function LineChartSvg({ groups }: { groups: ReportGroupRow[] }) {
  const width = 560;
  const height = 160;
  const padding = 24;
  const max = Math.max(1, ...groups.map((g) => g.value));
  const stepX = groups.length > 1 ? (width - padding * 2) / (groups.length - 1) : 0;
  const points = groups.map((g, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (g.value / max) * (height - padding * 2);
    return { x, y, g };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: Math.max(320, groups.length * 40) }}>
        <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
            <title>{`${p.g.label}: ${p.g.value.toLocaleString()}`}</title>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-subtle mt-1 px-1">
        <span>{groups[0]?.label}</span>
        {groups.length > 1 && <span>{groups[groups.length - 1]?.label}</span>}
      </div>
    </div>
  );
}

function PieChartSvg({ groups, onSliceClick }: { groups: ReportGroupRow[]; onSliceClick?: (g: ReportGroupRow) => void }) {
  const total = groups.reduce((sum, g) => sum + g.value, 0) || 1;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const slices = groups.reduce<{ g: ReportGroupRow; dash: number; offset: number }[]>((acc, g) => {
    const dash = (g.value / total) * circumference;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    return [...acc, { g, dash, offset }];
  }, []);

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 140 140" className="w-full max-w-[140px] shrink-0">
        <g transform="rotate(-90 70 70)">
          {slices.map(({ g, dash, offset }, i) => (
            <circle
              key={g.rawValue}
              cx={70}
              cy={70}
              r={radius}
              fill="none"
              stroke={PIE_COLORS[i % PIE_COLORS.length]}
              strokeWidth={28}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              className={onSliceClick ? "cursor-pointer" : undefined}
              onClick={onSliceClick ? () => onSliceClick(g) : undefined}
            >
              <title>{`${g.label}: ${g.value.toLocaleString()}`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="space-y-1.5 min-w-0 flex-1">
        {groups.map((g, i) => (
          <div key={g.rawValue} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="truncate">{g.label}</span>
            <span className="text-subtle tabular-nums shrink-0">{g.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  if (display === "line") {
    return <LineChartSvg groups={result.groups} />;
  }

  if (display === "pie") {
    return <PieChartSvg groups={result.groups} />;
  }

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
      ) : display === "pie" ? (
        <PieChartSvg groups={result.groups} onSliceClick={(g) => setActiveGroup(g)} />
      ) : display === "line" ? (
        <div className="space-y-2">
          <LineChartSvg groups={result.groups} />
          <div className="flex flex-wrap gap-2">
            {result.groups.map((g) => (
              <button
                key={g.rawValue}
                onClick={() => setActiveGroup(g)}
                className="px-2 py-1 rounded text-[11px] border border-border hover:bg-muted/40 transition-colors"
              >
                {g.label}
              </button>
            ))}
          </div>
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

  // Portal straight to <body> — this panel only ever mounts from a click (activeGroup !== null
  // in the parent), always after hydration, so `document` is guaranteed to exist here; no SSR
  // guard needed. It's also used inside the dashboard grid, where react-grid-layout applies CSS
  // transforms to every widget for drag positioning — a `transform` on any ancestor turns
  // `position: fixed` into container-relative instead of viewport-relative, which would trap
  // this panel inside the widget's small box. The portal escapes that regardless of call site.
  // react-grid-layout applies CSS transforms to every widget for drag positioning. A
  // `transform` on any ancestor turns `position: fixed` into container-relative instead of
  // viewport-relative, which would trap this panel inside the widget's small box. Mounting via
  // portal escapes that regardless of where the panel is rendered from.
  return createPortal(
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
    </>,
    document.body
  );
}
