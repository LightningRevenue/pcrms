"use server";

import { db } from "@/lib/db";

export type StatsRange = "day" | "week" | "month";

function rangeStart(range: StatsRange, from: Date): Date {
  const d = new Date(from);
  if (range === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    const day = d.getDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function previousPeriod(range: StatsRange, start: Date): { start: Date; end: Date } {
  const end = new Date(start);
  const prevStart = new Date(start);
  if (range === "day") prevStart.setDate(prevStart.getDate() - 1);
  else if (range === "week") prevStart.setDate(prevStart.getDate() - 7);
  else prevStart.setMonth(prevStart.getMonth() - 1);
  return { start: prevStart, end };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export type SalesTrackingStats = {
  totalOpens: { value: number; change: number | null };
  uniqueOpens: { value: number; change: number | null };
  contactsCreated: { value: number; change: number | null };
  emailsSent: { value: number; change: number | null };
  replies: { value: number; change: number | null };
  rangeLabel: string;
};

async function countAll(range: StatsRange, start: Date, end: Date) {
  const [totalOpens, uniqueOpensRows, contactsCreated, emailsSent, replies] = await Promise.all([
    db.emailOpen.count({ where: { openedAt: { gte: start, lt: end } } }),
    db.emailOpen.findMany({
      where: { openedAt: { gte: start, lt: end } },
      select: { email: { select: { personId: true } } },
    }),
    db.person.count({ where: { createdAt: { gte: start, lt: end } } }),
    db.email.count({ where: { direction: "sent", sentAt: { gte: start, lt: end } } }),
    db.email.count({ where: { direction: "received", personId: { not: null }, sentAt: { gte: start, lt: end } } }),
  ]);

  const uniqueOpens = new Set(uniqueOpensRows.map((r) => r.email.personId).filter(Boolean)).size;

  return { totalOpens, uniqueOpens, contactsCreated, emailsSent, replies };
}

const RANGE_LABELS: Record<StatsRange, string> = { day: "Today", week: "This week", month: "This month" };

export async function getSalesTrackingStats(range: StatsRange): Promise<SalesTrackingStats> {
  const now = new Date();
  const start = rangeStart(range, now);
  const { start: prevStart, end: prevEnd } = previousPeriod(range, start);

  const [current, previous] = await Promise.all([
    countAll(range, start, now),
    countAll(range, prevStart, prevEnd),
  ]);

  return {
    totalOpens: { value: current.totalOpens, change: pctChange(current.totalOpens, previous.totalOpens) },
    uniqueOpens: { value: current.uniqueOpens, change: pctChange(current.uniqueOpens, previous.uniqueOpens) },
    contactsCreated: { value: current.contactsCreated, change: pctChange(current.contactsCreated, previous.contactsCreated) },
    emailsSent: { value: current.emailsSent, change: pctChange(current.emailsSent, previous.emailsSent) },
    replies: { value: current.replies, change: pctChange(current.replies, previous.replies) },
    rangeLabel: RANGE_LABELS[range],
  };
}

export type TrendPoint = { date: string; label: string; emailsSent: number; opens: number };

// Daily trend for the last N days *ending today*, independent of the tile range —
// gives the chart enough points to read as a trend regardless of which range is selected.
export async function getActivityTrend(days = 14): Promise<TrendPoint[]> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [sentEmails, opens] = await Promise.all([
    db.email.findMany({
      where: { direction: "sent", sentAt: { gte: start, lte: end } },
      select: { sentAt: true },
    }),
    db.emailOpen.findMany({
      where: { openedAt: { gte: start, lte: end } },
      select: { openedAt: true },
    }),
  ]);

  const points: TrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dayKey = day.toDateString();
    points.push({
      date: day.toISOString(),
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      emailsSent: sentEmails.filter((e) => e.sentAt.toDateString() === dayKey).length,
      opens: opens.filter((o) => o.openedAt.toDateString() === dayKey).length,
    });
  }
  return points;
}

export type OwnershipRow = { userId: string; name: string; contacts: number; deals: number };

export async function getOwnershipByAgent(): Promise<OwnershipRow[]> {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { ownedPeople: true, ownedOpportunities: true } },
    },
    orderBy: { name: "asc" },
  });

  return users
    .filter((u) => u._count.ownedPeople > 0 || u._count.ownedOpportunities > 0)
    .map((u) => ({
      userId: u.id,
      name: u.name ?? u.email ?? "Unknown",
      contacts: u._count.ownedPeople,
      deals: u._count.ownedOpportunities,
    }))
    .sort((a, b) => b.contacts + b.deals - (a.contacts + a.deals));
}
