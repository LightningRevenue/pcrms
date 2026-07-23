"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import { getDrillDownRows, type DrillDownMetric, type DrillDownRow, type StatsRange } from "@/lib/actions/dashboard-stats";

const METRIC_TITLES: Record<DrillDownMetric, string> = {
  totalOpens: "Total opens",
  uniqueOpens: "Unique opens",
  contactsCreated: "Contacts created",
  emailsSent: "Emails sent",
  replies: "Replies",
};

function formatTimestamp(date: Date) {
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Slide-over triggered by clicking a stat tile or a point on the trend chart — shows the
// actual rows behind the number instead of leaving it as an opaque count.
export function DashboardDrilldownPanel({
  metric,
  range,
  day,
  onClose,
}: {
  metric: DrillDownMetric;
  range: StatsRange;
  day?: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DrillDownRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    getDrillDownRows(metric, range, day).then(setRows);
  }, [metric, range, day]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <div>
            <p className="text-[13px] font-medium">{METRIC_TITLES[metric]}</p>
            {day && <p className="text-[11px] text-subtle">{new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
          </div>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="text-[13px] text-subtle text-center py-10">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-10">Nothing here for this period.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] truncate">{r.title}</p>
                    <p className="text-[12px] text-subtle truncate mt-0.5">{r.subtitle}</p>
                    <p className="text-[11px] text-subtle mt-1">{formatTimestamp(r.timestamp)}</p>
                  </div>
                  <ArrowUpRight
                    size={13}
                    strokeWidth={1.75}
                    className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
