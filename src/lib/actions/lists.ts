"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type ListEntityType = "company" | "person" | "opportunity";

export async function listLists() {
  return db.list.findMany({
    include: { createdBy: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listListsForEntityType(entityType: ListEntityType) {
  return db.list.findMany({
    where: { entityType },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getList(id: string) {
  return db.list.findUnique({ where: { id }, include: { items: true } });
}

export async function listListsForEntity(entityType: ListEntityType, entityId: string) {
  return db.list.findMany({
    where: { entityType, items: { some: { entityId } } },
    orderBy: { name: "asc" },
  });
}

export async function listAvailableListsForEntity(entityType: ListEntityType, entityId: string) {
  const lists = await db.list.findMany({
    where: { entityType },
    include: { items: { where: { entityId } } },
    orderBy: { name: "asc" },
  });
  return lists.map((l) => ({ id: l.id, name: l.name, inList: l.items.length > 0 }));
}

export async function getListCompanies(entityIds: string[]) {
  return db.company.findMany({
    where: { id: { in: entityIds } },
    include: { createdBy: true, importBatch: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListPeople(entityIds: string[]) {
  return db.person.findMany({
    where: { id: { in: entityIds } },
    include: { company: true, createdBy: true, importBatch: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListOpportunities(entityIds: string[]) {
  return db.opportunity.findMany({
    where: { id: { in: entityIds } },
    include: { company: true, contact: true, owner: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createList(name: string, entityType: ListEntityType) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const list = await db.list.create({
    data: { name: trimmed, entityType, createdById: session.user.id },
  });
  revalidatePath("/lists");
  return list;
}

export async function deleteList(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.list.delete({ where: { id } });
  revalidatePath("/lists");
}

export async function searchEntitiesForList(listId: string, query: string) {
  const list = await db.list.findUniqueOrThrow({ where: { id: listId }, include: { items: true } });
  const inListIds = new Set(list.items.map((i) => i.entityId));
  const q = query.trim();
  const entityType = list.entityType as ListEntityType;

  let rows: { id: string; name: string; subtitle: string | null }[] = [];
  if (entityType === "company") {
    const companies = await db.company.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      orderBy: { name: "asc" },
      take: 30,
    });
    rows = companies.map((c) => ({ id: c.id, name: c.name, subtitle: c.domain }));
  } else if (entityType === "person") {
    const people = await db.person.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { firstName: "asc" },
      take: 30,
    });
    rows = people.map((p) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(" "), subtitle: p.email }));
  } else {
    const opportunities = await db.opportunity.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      orderBy: { name: "asc" },
      take: 30,
    });
    rows = opportunities.map((o) => ({ id: o.id, name: o.name, subtitle: o.stage }));
  }

  return rows.map((r) => ({ ...r, alreadyInList: inListIds.has(r.id) }));
}

export async function addToList(listId: string, entityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.listItem.upsert({
    where: { listId_entityId: { listId, entityId } },
    create: { listId, entityId },
    update: {},
  });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function removeFromList(listId: string, entityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.listItem.deleteMany({ where: { listId, entityId } });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}
