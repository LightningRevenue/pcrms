"use server";

import { db } from "@/lib/db";

// ponytail: no seed infra in this repo yet — upsert-on-read is simplest way to
// guarantee the built-in dashboards exist, since they're not user-creatable yet.
const BUILTIN_DASHBOARDS = [{ name: "Sales Tracking", kind: "sales-tracking", order: 0 }];

export async function listDashboards() {
  await Promise.all(
    BUILTIN_DASHBOARDS.map((d) =>
      db.dashboard.upsert({ where: { kind: d.kind }, create: d, update: { name: d.name, order: d.order } })
    )
  );
  return db.dashboard.findMany({ orderBy: { order: "asc" } });
}

export async function getDashboard(id: string) {
  return db.dashboard.findUnique({ where: { id } });
}
