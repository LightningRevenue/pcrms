"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAdmin } from "@/lib/workspace";
import { db } from "@/lib/db";

export type TrashEntityType = "company" | "person" | "opportunity";

export async function listTrash() {
  const { workspaceId } = await requireWorkspaceAdmin();

  const [companies, people, opportunities] = await Promise.all([
    db.company.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, deletedAt: true },
    }),
    db.person.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    }),
    db.opportunity.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, deletedAt: true },
    }),
  ]);

  return [
    ...companies.map((c) => ({ id: c.id, type: "company" as const, label: c.name, deletedAt: c.deletedAt! })),
    ...people.map((p) => ({
      id: p.id,
      type: "person" as const,
      label: [p.firstName, p.lastName].filter(Boolean).join(" "),
      deletedAt: p.deletedAt!,
    })),
    ...opportunities.map((o) => ({ id: o.id, type: "opportunity" as const, label: o.name, deletedAt: o.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

export async function restoreFromTrash(type: TrashEntityType, id: string) {
  const { workspaceId } = await requireWorkspaceAdmin();
  const where = { id, workspaceId };
  if (type === "company") await db.company.update({ where, data: { deletedAt: null } });
  else if (type === "person") await db.person.update({ where, data: { deletedAt: null } });
  else await db.opportunity.update({ where, data: { deletedAt: null } });
  revalidatePath("/settings/trash");
}

export async function purgeFromTrash(type: TrashEntityType, id: string) {
  const { workspaceId } = await requireWorkspaceAdmin();
  const where = { id, workspaceId };
  if (type === "company") await db.company.delete({ where });
  else if (type === "person") await db.person.delete({ where });
  else await db.opportunity.delete({ where });
  revalidatePath("/settings/trash");
}
