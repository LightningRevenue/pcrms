"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, personVisibilityFilter, opportunityVisibilityFilter, companyVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

export type ListEntityType = "company" | "person" | "opportunity";

export async function listLists() {
  const { workspaceId } = await requireWorkspace();
  return db.list.findMany({
    where: { workspaceId },
    include: { createdBy: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listListsForEntityType(entityType: ListEntityType) {
  const { workspaceId } = await requireWorkspace();
  return db.list.findMany({
    where: { workspaceId, entityType },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getList(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.list.findUnique({ where: { id, workspaceId }, include: { items: true } });
}

export async function listListsForEntity(entityType: ListEntityType, entityId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.list.findMany({
    where: { workspaceId, entityType, items: { some: { entityId } } },
    orderBy: { name: "asc" },
  });
}

export async function listAvailableListsForEntity(entityType: ListEntityType, entityId: string) {
  const { workspaceId } = await requireWorkspace();
  const lists = await db.list.findMany({
    where: { workspaceId, entityType },
    include: { items: { where: { entityId } } },
    orderBy: { name: "asc" },
  });
  return lists.map((l) => ({ id: l.id, name: l.name, inList: l.items.length > 0 }));
}

export async function getListCompanies(entityIds: string[]) {
  const ctx = await requireWorkspace();
  return db.company.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: entityIds }, ...companyVisibilityFilter(ctx) },
    include: { createdBy: true, importBatch: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListPeople(entityIds: string[]) {
  const ctx = await requireWorkspace();
  return db.person.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: entityIds }, ...personVisibilityFilter(ctx) },
    include: { company: true, createdBy: true, owner: true, importBatch: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListOpportunities(entityIds: string[]) {
  const ctx = await requireWorkspace();
  return db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: entityIds }, ...opportunityVisibilityFilter(ctx) },
    include: { company: true, contact: true, owner: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createList(name: string, entityType: ListEntityType) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "lists_feature");
  await assertLimit(workspaceId, "lists_count");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const list = await db.list.create({
    data: { workspaceId, name: trimmed, entityType, createdById: userId },
  });
  revalidatePath("/lists");
  return list;
}

export async function deleteList(id: string) {
  const { workspaceId } = await requireWorkspace();

  await db.list.delete({ where: { id, workspaceId } });
  revalidatePath("/lists");
}

export async function searchEntitiesForList(listId: string, query: string) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const list = await db.list.findUniqueOrThrow({ where: { id: listId, workspaceId }, include: { items: true } });
  const inListIds = new Set(list.items.map((i) => i.entityId));
  const q = query.trim();
  const entityType = list.entityType as ListEntityType;

  let rows: { id: string; name: string; subtitle: string | null }[] = [];
  if (entityType === "company") {
    const companies = await db.company.findMany({
      where: { workspaceId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}), ...companyVisibilityFilter(ctx) },
      orderBy: { name: "asc" },
      take: 30,
    });
    rows = companies.map((c) => ({ id: c.id, name: c.name, subtitle: c.domain }));
  } else if (entityType === "person") {
    const people = await db.person.findMany({
      where: {
        workspaceId,
        ...personVisibilityFilter(ctx),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { firstName: "asc" },
      take: 30,
    });
    rows = people.map((p) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(" "), subtitle: p.email }));
  } else {
    const opportunities = await db.opportunity.findMany({
      where: { workspaceId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}), ...opportunityVisibilityFilter(ctx) },
      orderBy: { name: "asc" },
      take: 30,
    });
    rows = opportunities.map((o) => ({ id: o.id, name: o.name, subtitle: o.stage }));
  }

  return rows.map((r) => ({ ...r, alreadyInList: inListIds.has(r.id) }));
}

export async function addToList(listId: string, entityId: string) {
  const { workspaceId } = await requireWorkspace();

  await db.listItem.upsert({
    where: { listId_entityId: { listId, entityId } },
    create: { workspaceId, listId, entityId },
    update: {},
  });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function removeFromList(listId: string, entityId: string) {
  const { workspaceId } = await requireWorkspace();

  await db.listItem.deleteMany({ where: { workspaceId, listId, entityId } });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}
