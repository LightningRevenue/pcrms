"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, MailOpen, Eye, UserPlus, Send, Reply, ArrowUpRight } from "lucide-react";
import {
  getSalesTrackingStats,
  getActivityTrend,
  getOwnershipByAgent,
  type StatsRange,
  type SalesTrackingStats,
  type TrendPoint,
  type OwnershipRow,
  type DrillDownMetric,
} from "@/lib/actions/dashboard-stats";
import { DashboardDrilldownPanel } from "@/components/dashboard-drilldown-panel";

const RANGES: { key: StatsRange; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function SalesTrackingDashboard({ name }: { name: string }) {
  const [range, setRange] = useState<StatsRange>("week");
  const [stats, setStats] = useState<SalesTrackingStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [ownership, setOwnership] = useState<OwnershipRow[] | null>(null);
  const [drilldown, setDrilldown] = useState<{ metric: DrillDownMetric; day?: string } | null>(null);

  useEffect(() => {
    getSalesTrackingStats(range).then(setStats);
  }, [range]);

  useEffect(() => {
    getActivityTrend(14).then(setTrend);
    getOwnershipByAgent().then(setOwnership);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <LayoutGrid size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{name}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                range === r.key ? "bg-surface text-foreground shadow-sm" : "text-subtle hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto w-full px-6 py-6 space-y-6">
          <div className="grid grid-cols-5 gap-3">
            <StatTile icon={Eye} label="Total opens" stat={stats?.totalOpens} onClick={() => setDrilldown({ metric: "totalOpens" })} />
            <StatTile icon={MailOpen} label="Unique opens" stat={stats?.uniqueOpens} onClick={() => setDrilldown({ metric: "uniqueOpens" })} />
            <StatTile icon={UserPlus} label="Contacts created" stat={stats?.contactsCreated} onClick={() => setDrilldown({ metric: "contactsCreated" })} />
            <StatTile icon={Send} label="Emails sent" stat={stats?.emailsSent} onClick={() => setDrilldown({ metric: "emailsSent" })} />
            <StatTile icon={Reply} label="Replies" stat={stats?.replies} onClick={() => setDrilldown({ metric: "replies" })} />
          </div>
          {stats && <p className="text-[12px] text-subtle -mt-3">{stats.rangeLabel}, vs. previous period</p>}

          <div className="border border-border rounded-md p-4">
            <p className="text-[13px] font-medium mb-4">Activity, last 14 days — click a day to see what happened</p>
            {trend ? (
              <TrendChart points={trend} onDayClick={(date) => setDrilldown({ metric: "emailsSent", day: date })} />
            ) : (
              <ChartSkeleton />
            )}
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[13px] font-medium">Ownership by agent</p>
            </div>
            {!ownership ? (
              <p className="text-[13px] text-subtle text-center py-6">Loading…</p>
            ) : ownership.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-6">No contacts or deals assigned yet.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] text-subtle uppercase tracking-wide">
                    <th className="text-left font-medium px-4 py-2">Agent</th>
                    <th className="text-right font-medium px-4 py-2">Contacts</th>
                    <th className="text-right font-medium px-4 py-2">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {ownership.map((o) => (
                    <tr key={o.userId} className="border-t border-border">
                      <td className="px-4 py-2 truncate">{o.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <Link href={`/contacts?owner=${o.userId}`} className="inline-flex items-center gap-1 hover:text-accent transition-colors group">
                          {o.contacts}
                          <ArrowUpRight size={11} strokeWidth={1.75} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <Link href={`/deals?owner=${o.userId}`} className="inline-flex items-center gap-1 hover:text-accent transition-colors group">
                          {o.deals}
                          <ArrowUpRight size={11} strokeWidth={1.75} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {drilldown && (
        <DashboardDrilldownPanel
          metric={drilldown.metric}
          range={range}
          day={drilldown.day}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  stat,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  stat: { value: number; change: number | null } | undefined;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!stat} className="text-left rounded-md border border-border p-3 hover:border-subtle hover:bg-muted/40 transition-colors disabled:cursor-default disabled:hover:border-border disabled:hover:bg-transparent">
      <div className="flex items-center gap-1.5 text-subtle">
        <Icon size={13} strokeWidth={1.5} />
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-semibold mt-1.5 tabular-nums">{stat?.value ?? "–"}</p>
      {stat && stat.change !== null && (
        <p className={`text-[11px] mt-0.5 ${stat.change >= 0 ? "text-accent" : "text-subtle"}`}>
          {stat.change >= 0 ? "+" : ""}
          {stat.change}% vs prior
        </p>
      )}
    </button>
  );
}

function ChartSkeleton() {
  return <div className="h-48 rounded bg-muted animate-pulse" />;
}

// Plain-SVG line chart, two series (emails sent / opens) sharing one axis — no
// charting library needed for a 14-point trend line.
function TrendChart({ points, onDayClick }: { points: TrendPoint[]; onDayClick: (date: string) => void }) {
  const width = 900;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxY = Math.max(1, ...points.map((p) => Math.max(p.emailsSent, p.opens)));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  function toXY(value: number, i: number) {
    const x = padding.left + i * stepX;
    const y = padding.top + innerH - (value / maxY) * innerH;
    return [x, y] as const;
  }

  function pathFor(key: "emailsSent" | "opens") {
    return points.map((p, i) => toXY(p[key], i)).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <Legend color="var(--accent)" label="Emails sent" />
        <Legend color="var(--subtle)" label="Opens" />
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH * (1 - f)}
            y2={padding.top + innerH * (1 - f)}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        <path d={pathFor("opens")} fill="none" stroke="var(--subtle)" strokeWidth={2} />
        <path d={pathFor("emailsSent")} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {points.map((p, i) => {
          const [x] = toXY(0, i);
          return (
            <rect
              key={p.date}
              x={x - stepX / 2}
              y={0}
              width={stepX || width}
              height={height}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => onDayClick(p.date)}
            />
          );
        })}

        {hoverIdx !== null && (
          <>
            <line
              x1={toXY(0, hoverIdx)[0]}
              x2={toXY(0, hoverIdx)[0]}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="var(--border)"
              strokeWidth={1}
            />
            {(["opens", "emailsSent"] as const).map((key) => {
              const [x, y] = toXY(points[hoverIdx][key], hoverIdx);
              return (
                <circle
                  key={key}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={key === "emailsSent" ? "var(--accent)" : "var(--subtle)"}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              );
            })}
          </>
        )}

        {points.map((p, i) => {
          if (i % Math.ceil(points.length / 7) !== 0) return null;
          const [x] = toXY(0, i);
          return (
            <text key={p.date} x={x} y={height - 4} fontSize={10} fill="var(--subtle)" textAnchor="middle">
              {p.label}
            </text>
          );
        })}
      </svg>

      {hoverIdx !== null && (
        <div className="text-[12px] text-subtle mt-1">
          {points[hoverIdx].label}: {points[hoverIdx].emailsSent} sent · {points[hoverIdx].opens} opens
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-subtle">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
