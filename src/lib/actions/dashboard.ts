"use server";

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
  const today = startOfDay(new Date());
  const tomorrow = daysAgo(-1);
  const weekAgo = daysAgo(6);

  const wonStages = await db.pipelineStage.findMany({ where: { outcome: "won" }, select: { label: true } });
  const wonLabels = wonStages.map((s) => s.label);

  const [newLeadsToday, contactedActivities, dealsWonThisWeek, pipelineOpenValue] = await Promise.all([
    db.person.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.activity.findMany({
      where: {
        entityType: "person",
        kind: { in: ["email_sent", "task_completed"] },
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { entityId: true },
      distinct: ["entityId"],
    }),
    wonLabels.length
      ? db.opportunity.count({ where: { stage: { in: wonLabels }, closeDate: { gte: weekAgo } } })
      : 0,
    db.opportunity.aggregate({
      _sum: { value: true },
      where: wonLabels.length ? { stage: { notIn: wonLabels } } : {},
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
  const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  const people = await db.person.findMany({
    where: { createdAt: { gte: days[0] } },
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
  const activities = await db.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });

  const personIds = activities.filter((a) => a.entityType === "person").map((a) => a.entityId);
  const companyIds = activities.filter((a) => a.entityType === "company").map((a) => a.entityId);
  const opportunityIds = activities.filter((a) => a.entityType === "opportunity").map((a) => a.entityId);

  const [people, companies, opportunities] = await Promise.all([
    personIds.length ? db.person.findMany({ where: { id: { in: personIds } } }) : [],
    companyIds.length ? db.company.findMany({ where: { id: { in: companyIds } } }) : [],
    opportunityIds.length ? db.opportunity.findMany({ where: { id: { in: opportunityIds } } }) : [],
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
