"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Responsive, WidthProvider, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import "react-grid-layout/css/styles.css";
import type { ReportEntity, CustomReportFilter } from "@/lib/custom-report-registry";
import { runCustomReport, type Aggregate, type Display, type DateGranularity, type ReportResult } from "@/lib/actions/custom-reports";
import { addWidget, updateWidget, deleteWidget, updateWidgetLayout } from "@/lib/actions/custom-dashboards";
import { ReportResultViewWithDrilldown } from "@/components/report-result-view";
import { ReportBuilder } from "@/components/report-builder";

const ResponsiveGridLayout = WidthProvider(Responsive);

type Widget = {
  id: string;
  name: string;
  entity: string;
  filters: unknown;
  groupBy: string | null;
  aggregate: string;
  display: string;
  dateGranularity: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type WorkspaceUser = { id: string; name: string | null; email: string | null };

export function CustomDashboardGrid({
  dashboardId,
  widgets,
  users,
}: {
  dashboardId: string;
  widgets: Widget[];
  users: WorkspaceUser[];
}) {
  const [editing, setEditing] = useState<Widget | "new" | null>(null);
  const [, startTransition] = useTransition();

  const layout: LayoutItem[] = useMemo(
    () => widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 })),
    [widgets]
  );

  function handleLayoutChange(next: Layout) {
    // Skip persisting on the initial mount call (identical to what's already stored) — only
    // write once the grid has actually settled from a drag/resize.
    const changed = next.some((l) => {
      const w = widgets.find((w) => w.id === l.i);
      return w && (w.x !== l.x || w.y !== l.y || w.w !== l.w || w.h !== l.h);
    });
    if (!changed) return;
    startTransition(() => {
      updateWidgetLayout(
        dashboardId,
        next.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
      );
    });
  }

  return (
    <div>
      <div className="flex justify-end px-8">
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          Add widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="mx-8 mt-4 px-4 py-10 text-center text-[13px] text-subtle border border-dashed border-border rounded-md">
          No widgets yet. Add one to start building this dashboard.
        </div>
      ) : (
        <ResponsiveGridLayout
          className="mt-4 px-4"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 900, sm: 0 }}
          cols={{ lg: 12, sm: 1 }}
          rowHeight={40}
          margin={[16, 16]}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((w) => (
            <div key={w.id} className="border border-border rounded-md bg-surface overflow-hidden flex flex-col">
              <div className="widget-drag-handle h-9 shrink-0 flex items-center justify-between px-3 border-b border-border cursor-move select-none">
                <span className="text-[13px] font-medium truncate">{w.name}</span>
                <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                  <button onClick={() => setEditing(w)} className="text-subtle hover:text-foreground transition-colors p-1">
                    <Pencil size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`Remove "${w.name}"?`)) return;
                      startTransition(() => deleteWidget(w.id, dashboardId));
                    }}
                    className="text-subtle hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <WidgetBody widget={w} />
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {editing !== null && (
        <WidgetModal
          dashboardId={dashboardId}
          users={users}
          existing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function WidgetBody({ widget }: { widget: Widget }) {
  const [result, setResult] = useState<ReportResult | null>(null);
  const filters = widget.filters as CustomReportFilter[];

  useEffect(() => {
    runCustomReport({
      entity: widget.entity as ReportEntity,
      filters,
      groupBy: widget.groupBy,
      aggregate: widget.aggregate as Aggregate,
      dateGranularity: widget.dateGranularity as DateGranularity,
    }).then(setResult);
  }, [widget.entity, filters, widget.groupBy, widget.aggregate, widget.dateGranularity]);

  if (!result) return <div className="h-32 rounded bg-muted animate-pulse" />;

  return (
    <ReportResultViewWithDrilldown
      result={result}
      display={widget.display as Display}
      entity={widget.entity as ReportEntity}
      filters={filters}
      groupBy={widget.groupBy}
    />
  );
}

function WidgetModal({
  dashboardId,
  users,
  existing,
  onClose,
}: {
  dashboardId: string;
  users: WorkspaceUser[];
  existing?: Widget;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] md:max-h-[85vh] top-8 bottom-8 z-50 bg-surface border border-border rounded-lg shadow-xl overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-end px-4 pt-3 bg-surface">
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-6 pb-6">
          <ReportBuilder
            users={users}
            existing={
              existing
                ? {
                    id: existing.id,
                    name: existing.name,
                    entity: existing.entity as ReportEntity,
                    filters: existing.filters as CustomReportFilter[],
                    groupBy: existing.groupBy,
                    aggregate: existing.aggregate as Aggregate,
                    display: existing.display as Display,
                    dateGranularity: existing.dateGranularity as DateGranularity,
                  }
                : undefined
            }
            onSave={async (input) => {
              if (existing) {
                await updateWidget(existing.id, dashboardId, input);
              } else {
                await addWidget(dashboardId, input);
              }
              onClose();
            }}
            onDelete={
              existing
                ? async () => {
                    await deleteWidget(existing.id, dashboardId);
                    onClose();
                  }
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
