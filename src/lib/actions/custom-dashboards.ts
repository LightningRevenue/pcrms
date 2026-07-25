"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { validateReportInput } from "@/lib/custom-report-registry";
import type { CreateCustomReportInput } from "@/lib/actions/custom-reports";

export async function listCustomDashboards() {
  const { workspaceId } = await requireWorkspace();
  return db.customDashboard.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function getCustomDashboard(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.customDashboard.findUnique({
    where: { id, workspaceId },
    include: { widgets: true },
  });
}

export async function createCustomDashboard(name: string) {
  const { userId, workspaceId } = await requireWorkspace();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const dashboard = await db.customDashboard.create({
    data: { workspaceId, name: trimmed, createdById: userId },
  });

  revalidatePath("/dashboards");
  return dashboard;
}

export async function renameCustomDashboard(id: string, name: string) {
  const { workspaceId } = await requireWorkspace();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  await db.customDashboard.update({ where: { id, workspaceId }, data: { name: trimmed } });
  revalidatePath("/dashboards");
  revalidatePath(`/dashboards/custom/${id}`);
}

export async function deleteCustomDashboard(id: string) {
  const { workspaceId } = await requireWorkspace();
  await db.customDashboard.delete({ where: { id, workspaceId } });
  revalidatePath("/dashboards");
}

// Scopes a dashboardId to the caller's workspace via its parent — DashboardWidget has no
// workspaceId of its own, so every widget mutation must go through this check first.
async function requireOwnedDashboard(workspaceId: string, dashboardId: string) {
  const dashboard = await db.customDashboard.findUnique({ where: { id: dashboardId, workspaceId }, select: { id: true } });
  if (!dashboard) throw new Error("Dashboard not found");
}

export async function addWidget(dashboardId: string, input: CreateCustomReportInput) {
  const { workspaceId } = await requireWorkspace();
  await requireOwnedDashboard(workspaceId, dashboardId);
  const name = validateReportInput(input);

  const widget = await db.dashboardWidget.create({
    data: {
      dashboardId,
      name,
      entity: input.entity,
      filters: input.filters,
      groupBy: input.groupBy,
      aggregate: input.aggregate,
      display: input.display,
      dateGranularity: input.dateGranularity ?? "day",
    },
  });

  revalidatePath(`/dashboards/custom/${dashboardId}`);
  return widget;
}

export async function updateWidget(id: string, dashboardId: string, input: CreateCustomReportInput) {
  const { workspaceId } = await requireWorkspace();
  await requireOwnedDashboard(workspaceId, dashboardId);
  const name = validateReportInput(input);

  await db.dashboardWidget.update({
    where: { id, dashboardId },
    data: {
      name,
      entity: input.entity,
      filters: input.filters,
      groupBy: input.groupBy,
      aggregate: input.aggregate,
      display: input.display,
      dateGranularity: input.dateGranularity ?? "day",
    },
  });

  revalidatePath(`/dashboards/custom/${dashboardId}`);
}

export async function deleteWidget(id: string, dashboardId: string) {
  const { workspaceId } = await requireWorkspace();
  await requireOwnedDashboard(workspaceId, dashboardId);
  await db.dashboardWidget.delete({ where: { id, dashboardId } });
  revalidatePath(`/dashboards/custom/${dashboardId}`);
}

export type WidgetPosition = { id: string; x: number; y: number; w: number; h: number };

export async function updateWidgetLayout(dashboardId: string, positions: WidgetPosition[]) {
  const { workspaceId } = await requireWorkspace();
  await requireOwnedDashboard(workspaceId, dashboardId);

  await db.$transaction(
    positions.map((p) =>
      db.dashboardWidget.update({
        where: { id: p.id, dashboardId },
        data: { x: p.x, y: p.y, w: p.w, h: p.h },
      })
    )
  );
}
