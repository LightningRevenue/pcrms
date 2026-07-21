"use server";

import { requireWorkspace, personVisibilityFilter, companyVisibilityFilter, opportunityVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

export async function getDashboardStats() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const today = startOfDay(new Date());
  const tomorrow = daysAgo(-1);
  const weekAgo = daysAgo(6);

  const wonStages = await db.pipelineStage.findMany({ where: { workspaceId, outcome: "won" }, select: { label: true } });
  const wonLabels = wonStages.map((s) => s.label);

  const [newLeadsToday, contactedActivities, dealsWonThisWeek, pipelineOpenValue] = await Promise.all([
    db.person.count({ where: { workspaceId, createdAt: { gte: today, lt: tomorrow }, ...personVisibilityFilter(ctx) } }),
    db.activity.findMany({
      where: {
        workspaceId,
        entityType: "person",
        kind: { in: ["email_sent", "task_completed"] },
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { entityId: true },
      distinct: ["entityId"],
    }),
    wonLabels.length
      ? db.opportunity.count({
          where: { workspaceId, stage: { in: wonLabels }, closeDate: { gte: weekAgo }, ...opportunityVisibilityFilter(ctx) },
        })
      : 0,
    db.opportunity.aggregate({
      _sum: { value: true },
      where: {
        workspaceId,
        ...(wonLabels.length ? { stage: { notIn: wonLabels } } : {}),
        ...opportunityVisibilityFilter(ctx),
      },
    }),
  ]);

  return {
    newLeadsToday,
    contactedToday: contactedActivities.length,
    dealsWonThisWeek,
    pipelineOpenValue: pipelineOpenValue._sum.value ?? 0,
  };
}

export async function getNewLeadsTrend() {
  const ctx = await requireWorkspace();
  const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  const people = await db.person.findMany({
    where: { workspaceId: ctx.workspaceId, createdAt: { gte: days[0] }, ...personVisibilityFilter(ctx) },
    select: { createdAt: true },
  });

  return days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const count = people.filter((p) => p.createdAt >= day && p.createdAt < next).length;
    return { date: day, count };
  });
}

export async function getRecentActivity(limit = 8) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const activities = await db.activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });

  const personIds = activities.filter((a) => a.entityType === "person").map((a) => a.entityId);
  const companyIds = activities.filter((a) => a.entityType === "company").map((a) => a.entityId);
  const opportunityIds = activities.filter((a) => a.entityType === "opportunity").map((a) => a.entityId);

  const [people, companies, opportunities] = await Promise.all([
    personIds.length ? db.person.findMany({ where: { workspaceId, id: { in: personIds }, ...personVisibilityFilter(ctx) } }) : [],
    companyIds.length ? db.company.findMany({ where: { workspaceId, id: { in: companyIds }, ...companyVisibilityFilter(ctx) } }) : [],
    opportunityIds.length
      ? db.opportunity.findMany({ where: { workspaceId, id: { in: opportunityIds }, ...opportunityVisibilityFilter(ctx) } })
      : [],
  ]);

  const personMap = new Map(people.map((p) => [p.id, p]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const opportunityMap = new Map(opportunities.map((o) => [o.id, o]));

  return activities.map((a) => {
    let entityName = "Unknown";
    let href = "#";
    if (a.entityType === "person") {
      const p = personMap.get(a.entityId);
      entityName = p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "Deleted contact";
      href = `/contacts/${a.entityId}`;
    } else if (a.entityType === "company") {
      const c = companyMap.get(a.entityId);
      entityName = c?.name || "Deleted company";
      href = `/companies/${a.entityId}`;
    } else if (a.entityType === "opportunity") {
      const o = opportunityMap.get(a.entityId);
      entityName = o?.name || "Deleted opportunity";
      href = `/deals/${a.entityId}`;
    }
    return { ...a, entityName, href };
  });
}
