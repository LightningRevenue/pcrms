"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, TrendingUp, TrendingDown, Target, X, ArrowUpRight } from "lucide-react";
import {
  getPipelineFunnel,
  getWinRate,
  getForecast,
  getDealsInStage,
  type FunnelStage,
  type WinRateStats,
  type ForecastStats,
  type FunnelDrillDownRow,
} from "@/lib/actions/pipeline-funnel-stats";

function formatValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value}`;
}

const OUTCOME_COLOR: Record<string, string> = {
  open: "bg-blue-500",
  won: "bg-emerald-500",
  lost: "bg-rose-500",
};

export function PipelineFunnelDashboard({ name }: { name: string }) {
  const [funnel, setFunnel] = useState<FunnelStage[] | null>(null);
  const [winRate, setWinRate] = useState<WinRateStats | null>(null);
  const [forecast, setForecast] = useState<ForecastStats | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    getPipelineFunnel().then(setFunnel);
    getWinRate().then(setWinRate);
    getForecast().then(setForecast);
  }, []);

  const maxCount = Math.max(1, ...(funnel ?? []).map((s) => s.count));

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <LayoutGrid size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{name}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto w-full px-6 py-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <MetricTile
              icon={Target}
              label="Open pipeline"
              value={forecast ? formatValue(forecast.openValue) : "–"}
              sub={forecast ? `${forecast.openCount} open deal${forecast.openCount === 1 ? "" : "s"}` : undefined}
            />
            <MetricTile
              icon={winRate && winRate.winRatePct !== null && winRate.winRatePct >= 50 ? TrendingUp : TrendingDown}
              label="Win rate (90 days)"
              value={winRate?.winRatePct !== null && winRate?.winRatePct !== undefined ? `${winRate.winRatePct}%` : "No closed deals yet"}
              sub={winRate ? `${winRate.wonCount} won · ${winRate.lostCount} lost` : undefined}
            />
            <MetricTile
              icon={Target}
              label="Forecast"
              value={forecast ? formatValue(forecast.weightedValue) : "–"}
              sub="Open value × win rate"
            />
          </div>

          <div className="border border-border rounded-md p-4">
            <p className="text-[13px] font-medium mb-1">Pipeline by stage</p>
            <p className="text-[12px] text-subtle mb-4">Click a stage to see the deals in it.</p>

            {funnel === null ? (
              <div className="h-40 rounded bg-muted animate-pulse" />
            ) : funnel.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-8">
                No stages defined yet —{" "}
                <Link href="/settings/pipeline" className="text-accent hover:underline">
                  set up your deal pipeline
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2.5">
                {funnel.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveStage(s.label)}
                    className="w-full flex items-center gap-3 group"
                  >
                    <span className="w-28 shrink-0 text-[13px] text-left truncate">{s.label}</span>
                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden relative">
                      <div
                        className={`h-full transition-all ${OUTCOME_COLOR[s.outcome] ?? "bg-subtle"} group-hover:opacity-80`}
                        style={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-[12px] text-subtle text-right tabular-nums">{s.count}</span>
                    <span className="w-16 shrink-0 text-[12px] text-subtle text-right tabular-nums">{formatValue(s.value)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeStage && <StageDrilldownPanel stageLabel={activeStage} onClose={() => setActiveStage(null)} />}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-subtle">
        <Icon size={13} strokeWidth={1.5} />
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-semibold mt-1.5">{value}</p>
      {sub && <p className="text-[11px] text-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

function StageDrilldownPanel({ stageLabel, onClose }: { stageLabel: string; onClose: () => void }) {
  const [rows, setRows] = useState<FunnelDrillDownRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    getDealsInStage(stageLabel).then(setRows);
  }, [stageLabel]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <p className="text-[13px] font-medium">{stageLabel}</p>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="text-[13px] text-subtle text-center py-10">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-10">No deals on this stage.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/deals/${r.id}`}
                  className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] truncate">{r.name}</p>
                    <p className="text-[12px] text-subtle truncate mt-0.5">{r.owner ?? "No owner"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] tabular-nums text-subtle">{formatValue(r.value)}</span>
                    <ArrowUpRight size={13} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
