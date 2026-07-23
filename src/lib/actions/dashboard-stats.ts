"use server";

import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
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

async function countAll(ctx: Awaited<ReturnType<typeof requireWorkspace>>, range: StatsRange, start: Date, end: Date) {
  const { workspaceId } = ctx;
  const [totalOpens, uniqueOpensRows, contactsCreated, emailsSent, replies] = await Promise.all([
    db.emailOpen.count({ where: { workspaceId, openedAt: { gte: start, lt: end } } }),
    db.emailOpen.findMany({
      where: { workspaceId, openedAt: { gte: start, lt: end } },
      select: { email: { select: { personId: true } } },
    }),
    db.person.count({ where: { workspaceId, createdAt: { gte: start, lt: end }, ...personVisibilityFilter(ctx) } }),
    db.email.count({ where: { workspaceId, direction: "sent", sentAt: { gte: start, lt: end } } }),
    db.email.count({ where: { workspaceId, direction: "received", personId: { not: null }, sentAt: { gte: start, lt: end } } }),
  ]);

  const uniqueOpens = new Set(uniqueOpensRows.map((r) => r.email.personId).filter(Boolean)).size;

  return { totalOpens, uniqueOpens, contactsCreated, emailsSent, replies };
}

const RANGE_LABELS: Record<StatsRange, string> = { day: "Today", week: "This week", month: "This month" };

export async function getSalesTrackingStats(range: StatsRange): Promise<SalesTrackingStats> {
  const ctx = await requireWorkspace();
  const now = new Date();
  const start = rangeStart(range, now);
  const { start: prevStart, end: prevEnd } = previousPeriod(range, start);

  const [current, previous] = await Promise.all([
    countAll(ctx, range, start, now),
    countAll(ctx, range, prevStart, prevEnd),
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
  const { workspaceId } = await requireWorkspace();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [sentEmails, opens] = await Promise.all([
    db.email.findMany({
      where: { workspaceId, direction: "sent", sentAt: { gte: start, lte: end } },
      select: { sentAt: true },
    }),
    db.emailOpen.findMany({
      where: { workspaceId, openedAt: { gte: start, lte: end } },
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

// Drill-down: same range math as getSalesTrackingStats/countAll, but returning the actual
// rows behind a stat tile instead of just the count — clicking a tile opens these in a panel.
export type DrillDownMetric = "totalOpens" | "uniqueOpens" | "contactsCreated" | "emailsSent" | "replies";

export type DrillDownRow = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  timestamp: Date;
};

export async function getDrillDownRows(metric: DrillDownMetric, range: StatsRange, day?: string): Promise<DrillDownRow[]> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const now = new Date();

  let start: Date;
  let end: Date;
  if (day) {
    // A specific day clicked on the trend chart overrides the tile range entirely.
    start = new Date(day);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else {
    start = rangeStart(range, now);
    end = now;
  }

  if (metric === "contactsCreated") {
    const people = await db.person.findMany({
      where: { workspaceId, createdAt: { gte: start, lt: end }, ...personVisibilityFilter(ctx) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    });
    return people.map((p) => ({
      id: p.id,
      title: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled",
      subtitle: p.email ?? "",
      href: `/contacts/${p.id}`,
      timestamp: p.createdAt,
    }));
  }

  if (metric === "emailsSent") {
    const emails = await db.email.findMany({
      where: { workspaceId, direction: "sent", sentAt: { gte: start, lt: end } },
      orderBy: { sentAt: "desc" },
      take: 100,
      select: { id: true, subject: true, to: true, sentAt: true, personId: true },
    });
    return emails.map((e) => ({
      id: e.id,
      title: e.subject || "(no subject)",
      subtitle: `to ${e.to.join(", ")}`,
      href: e.personId ? `/contacts/${e.personId}?tab=emails&emailId=${e.id}` : "/inbox",
      timestamp: e.sentAt,
    }));
  }

  if (metric === "replies") {
    const emails = await db.email.findMany({
      where: { workspaceId, direction: "received", personId: { not: null }, sentAt: { gte: start, lt: end } },
      orderBy: { sentAt: "desc" },
      take: 100,
      select: { id: true, subject: true, from: true, sentAt: true, personId: true },
    });
    return emails.map((e) => ({
      id: e.id,
      title: e.subject || "(no subject)",
      subtitle: `from ${e.from}`,
      href: `/contacts/${e.personId}?tab=emails&emailId=${e.id}`,
      timestamp: e.sentAt,
    }));
  }

  // totalOpens / uniqueOpens — both come from EmailOpen rows; uniqueOpens just dedupes by
  // personId client-side-equivalent below (same de-dup rule as countAll's uniqueOpens).
  const opens = await db.emailOpen.findMany({
    where: { workspaceId, openedAt: { gte: start, lt: end } },
    orderBy: { openedAt: "desc" },
    take: 200,
    select: {
      id: true,
      openedAt: true,
      email: { select: { id: true, subject: true, personId: true, person: { select: { firstName: true, lastName: true } } } },
    },
  });

  function toRow(o: (typeof opens)[number]): DrillDownRow {
    return {
      id: o.id,
      title: o.email.subject || "(no subject)",
      subtitle: o.email.person ? [o.email.person.firstName, o.email.person.lastName].filter(Boolean).join(" ") : "Unknown contact",
      href: o.email.personId ? `/contacts/${o.email.personId}?tab=emails&emailId=${o.email.id}` : "/inbox",
      timestamp: o.openedAt,
    };
  }

  if (metric === "totalOpens") return opens.map(toRow);

  const seen = new Set<string>();
  return opens
    .filter((o) => {
      const personId = o.email.personId;
      if (!personId) return true; // no contact to dedupe by — keep it
      if (seen.has(personId)) return false;
      seen.add(personId);
      return true;
    })
    .map(toRow);
}

export type OwnershipRow = { userId: string; name: string; contacts: number; deals: number };

export async function getOwnershipByAgent(): Promise<OwnershipRow[]> {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  // Was previously unscoped (db.user.findMany with no workspaceId filter at all) — fixed here
  // regardless of role: only count members of THIS workspace, via WorkspaceMember, not every
  // User in the system. A plain member additionally only ever sees their own row (this table
  // is inherently a cross-user breakdown, which is the one piece of workspace-wide "who owns
  // what" info a member's otherwise-scoped view wouldn't reveal any other way).
  const members = await db.workspaceMember.findMany({
    where: ctx.role === "owner" || ctx.role === "admin" ? { workspaceId } : { workspaceId, userId: ctx.userId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          _count: {
            select: {
              ownedPeople: { where: { workspaceId } },
              ownedOpportunities: { where: { workspaceId } },
            },
          },
        },
      },
    },
  });

  return members
    .map((m) => m.user)
    .filter((u) => u._count.ownedPeople > 0 || u._count.ownedOpportunities > 0)
    .map((u) => ({
      userId: u.id,
      name: u.name ?? u.email ?? "Unknown",
      contacts: u._count.ownedPeople,
      deals: u._count.ownedOpportunities,
    }))
    .sort((a, b) => b.contacts + b.deals - (a.contacts + a.deals));
}
