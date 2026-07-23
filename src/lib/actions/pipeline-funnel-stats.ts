"use server";

import { requireWorkspace, opportunityVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";

export type FunnelStage = {
  id: string;
  label: string;
  outcome: string;
  order: number;
  count: number;
  value: number;
};

// One row per PipelineStage, in order, with the count/value of every non-deleted deal
// currently sitting on that stage — the funnel. Deals whose stage string doesn't match any
// current PipelineStage.label (renamed/deleted stage) are silently excluded, same as the
// Kanban board on /deals already does.
export async function getPipelineFunnel(): Promise<FunnelStage[]> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const [stages, opportunities] = await Promise.all([
    db.pipelineStage.findMany({ where: { workspaceId }, orderBy: { order: "asc" } }),
    db.opportunity.findMany({
      where: { workspaceId, ...opportunityVisibilityFilter(ctx) },
      select: { stage: true, value: true },
    }),
  ]);

  return stages.map((s) => {
    const inStage = opportunities.filter((o) => o.stage === s.label);
    return {
      id: s.id,
      label: s.label,
      outcome: s.outcome,
      order: s.order,
      count: inStage.length,
      value: inStage.reduce((sum, o) => sum + o.value, 0),
    };
  });
}

export type WinRateStats = {
  wonCount: number;
  lostCount: number;
  wonValue: number;
  lostValue: number;
  winRatePct: number | null; // null when there's no closed history yet to compute a rate from
};

// "Closed" = stage.outcome is won or lost — open deals aren't part of the rate. Scoped to
// closeDate within the last `days` so the rate reflects recent performance, not all-time.
export async function getWinRate(days = 90): Promise<WinRateStats> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const stages = await db.pipelineStage.findMany({ where: { workspaceId }, select: { label: true, outcome: true } });
  const wonLabels = stages.filter((s) => s.outcome === "won").map((s) => s.label);
  const lostLabels = stages.filter((s) => s.outcome === "lost").map((s) => s.label);

  const [won, lost] = await Promise.all([
    db.opportunity.findMany({
      where: { workspaceId, ...opportunityVisibilityFilter(ctx), stage: { in: wonLabels }, closeDate: { gte: since } },
      select: { value: true },
    }),
    db.opportunity.findMany({
      where: { workspaceId, ...opportunityVisibilityFilter(ctx), stage: { in: lostLabels }, closeDate: { gte: since } },
      select: { value: true },
    }),
  ]);

  const wonCount = won.length;
  const lostCount = lost.length;
  const totalClosed = wonCount + lostCount;

  return {
    wonCount,
    lostCount,
    wonValue: won.reduce((sum, o) => sum + o.value, 0),
    lostValue: lost.reduce((sum, o) => sum + o.value, 0),
    winRatePct: totalClosed === 0 ? null : Math.round((wonCount / totalClosed) * 100),
  };
}

export type ForecastStats = {
  openValue: number;
  openCount: number;
  weightedValue: number; // openValue * winRatePct, the simple "what we'd expect to close" number
  winRatePct: number | null;
};

// Deliberately simple: total open-deal value times the overall win rate (getWinRate) —
// not a per-stage probability curve, since nothing in the schema defines per-stage odds and
// guessing them would be worse than this one honest, easily-explained number.
export async function getForecast(): Promise<ForecastStats> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const stages = await db.pipelineStage.findMany({ where: { workspaceId }, select: { label: true, outcome: true } });
  const openLabels = stages.filter((s) => s.outcome === "open").map((s) => s.label);

  const [open, winRate] = await Promise.all([
    db.opportunity.findMany({
      where: { workspaceId, ...opportunityVisibilityFilter(ctx), stage: { in: openLabels } },
      select: { value: true },
    }),
    getWinRate(),
  ]);

  const openValue = open.reduce((sum, o) => sum + o.value, 0);
  const rate = winRate.winRatePct;

  return {
    openValue,
    openCount: open.length,
    weightedValue: rate === null ? 0 : Math.round(openValue * (rate / 100)),
    winRatePct: rate,
  };
}

export type FunnelDrillDownRow = { id: string; name: string; value: number; owner: string | null; closeDate: Date | null };

// Behind a funnel-stage bar click: every deal currently on that stage.
export async function getDealsInStage(stageLabel: string): Promise<FunnelDrillDownRow[]> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const deals = await db.opportunity.findMany({
    where: { workspaceId, ...opportunityVisibilityFilter(ctx), stage: stageLabel },
    orderBy: { value: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  return deals.map((d) => ({
    id: d.id,
    name: d.name || "Untitled",
    value: d.value,
    owner: d.owner?.name ?? d.owner?.email ?? null,
    closeDate: d.closeDate,
  }));
}
