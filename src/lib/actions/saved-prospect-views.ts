"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { ProspectFilters } from "@/lib/prospect-filters";

export type SavedView = {
  id: string;
  name: string;
  filters: ProspectFilters;
  createdById: string;
};

// `filters` is a Json column; it only ever holds what createSavedView/updateSavedViewFilters
// wrote, so it's cast rather than re-validated — same trust boundary as CustomReport.filters.
const toSavedView = (row: { id: string; name: string; filters: unknown; createdById: string }): SavedView => ({
  id: row.id,
  name: row.name,
  filters: (row.filters ?? {}) as ProspectFilters,
  createdById: row.createdById,
});

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("View name is required");
  return trimmed.slice(0, 80);
}

/** The signed-in user's own views — this is the list rendered in the Contacts switcher. */
export async function listSavedViews(): Promise<SavedView[]> {
  const { workspaceId, userId } = await requireWorkspace();
  const rows = await db.savedProspectView.findMany({
    where: { workspaceId, createdById: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, filters: true, createdById: true },
  });
  return rows.map(toSavedView);
}

// Deliberately NOT scoped to createdById: a ?view=<id> link has to open for any colleague the
// owner shares it with. workspaceId still comes from the session, never from the caller, so
// this can't read across tenants — it only relaxes ownership *within* one workspace. Every
// write path below keeps the createdById gate, so a recipient can read and fork but not edit.
export async function getSavedView(id: string): Promise<SavedView | null> {
  const { workspaceId } = await requireWorkspace();
  const row = await db.savedProspectView.findFirst({
    where: { id, workspaceId },
    select: { id: true, name: true, filters: true, createdById: true },
  });
  return row ? toSavedView(row) : null;
}

export async function createSavedView(name: string, filters: ProspectFilters): Promise<SavedView> {
  const { workspaceId, userId } = await requireWorkspace();
  const row = await db.savedProspectView.create({
    data: {
      workspaceId,
      createdById: userId,
      name: cleanName(name),
      filters: filters as object,
    },
    select: { id: true, name: true, filters: true, createdById: true },
  });
  revalidatePath("/contacts");
  return toSavedView(row);
}

export async function updateSavedViewFilters(id: string, filters: ProspectFilters): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  await db.savedProspectView.updateMany({
    where: { id, workspaceId, createdById: userId },
    data: { filters: filters as object },
  });
  revalidatePath("/contacts");
}

export async function renameSavedView(id: string, name: string): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  await db.savedProspectView.updateMany({
    where: { id, workspaceId, createdById: userId },
    data: { name: cleanName(name) },
  });
  revalidatePath("/contacts");
}

export async function deleteSavedView(id: string): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  await db.savedProspectView.deleteMany({ where: { id, workspaceId, createdById: userId } });
  revalidatePath("/contacts");
}
