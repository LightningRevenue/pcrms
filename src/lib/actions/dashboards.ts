"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

// ponytail: no seed infra in this repo yet — upsert-on-read is simplest way to
// guarantee the built-in dashboards exist, since they're not user-creatable yet.
const BUILTIN_DASHBOARDS = [
  { name: "Sales Tracking", kind: "sales-tracking", order: 0 },
  { name: "Pipeline", kind: "pipeline-funnel", order: 1 },
  { name: "Sequences", kind: "sequence-performance", order: 2 },
];

export async function listDashboards() {
  const { workspaceId } = await requireWorkspace();
  await Promise.all(
    BUILTIN_DASHBOARDS.map((d) =>
      db.dashboard.upsert({
        where: { workspaceId_kind: { workspaceId, kind: d.kind } },
        create: { workspaceId, name: d.name, kind: d.kind, order: d.order },
        update: { name: d.name, order: d.order },
      })
    )
  );
  return db.dashboard.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
}

export async function getDashboard(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.dashboard.findUnique({ where: { id, workspaceId } });
}
