"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceOwner } from "@/lib/workspace";
import { db } from "@/lib/db";
import { isGdprModuleEnabled } from "@/lib/gdpr";

async function requireGdprAccess() {
  const ctx = await requireWorkspaceOwner();
  if (!(await isGdprModuleEnabled(ctx.workspaceId))) throw new Error("GDPR module is not enabled on your plan");
  return ctx;
}

export async function listGdprRequests() {
  const { workspaceId } = await requireGdprAccess();
  return db.gdprRequest.findMany({
    where: { workspaceId },
    include: { person: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { requestedAt: "desc" },
  });
}

export type GdprRequestInput = {
  type: "access" | "erasure" | "export";
  subjectName?: string;
  subjectEmail?: string;
  personId?: string;
  note?: string;
};

export async function createGdprRequest(input: GdprRequestInput) {
  const { workspaceId, userId } = await requireGdprAccess();
  if (!input.subjectEmail?.trim() && !input.personId) throw new Error("Link a contact or enter an email");

  const request = await db.gdprRequest.create({
    data: {
      workspaceId,
      type: input.type,
      personId: input.personId || null,
      subjectName: input.subjectName?.trim() || null,
      subjectEmail: input.subjectEmail?.trim() || null,
      note: input.note?.trim() || null,
      handledById: userId,
    },
  });

  revalidatePath("/settings/gdpr");
  return request;
}

export async function updateGdprRequestStatus(id: string, status: "open" | "in_progress" | "completed") {
  const { workspaceId } = await requireGdprAccess();

  const request = await db.gdprRequest.update({
    where: { id, workspaceId },
    data: { status, completedAt: status === "completed" ? new Date() : null },
  });

  revalidatePath("/settings/gdpr");
  return request;
}

export async function deleteGdprRequest(id: string) {
  const { workspaceId } = await requireGdprAccess();
  await db.gdprRequest.delete({ where: { id, workspaceId } });
  revalidatePath("/settings/gdpr");
}

export async function listUnsubscribedContacts() {
  const { workspaceId } = await requireGdprAccess();
  return db.person.findMany({
    where: { workspaceId, unsubscribedAt: { not: null }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, unsubscribedAt: true },
    orderBy: { unsubscribedAt: "desc" },
  });
}

export async function searchContactsForGdpr(query: string) {
  const { workspaceId } = await requireGdprAccess();
  const q = query.trim();
  if (!q) return [];
  return db.person.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, firstName: true, lastName: true, email: true, unsubscribedAt: true },
    take: 10,
  });
}

export async function setPersonUnsubscribed(personId: string, unsubscribed: boolean) {
  const { workspaceId } = await requireGdprAccess();
  await db.person.update({
    where: { id: personId, workspaceId },
    data: { unsubscribedAt: unsubscribed ? new Date() : null },
  });
  revalidatePath("/settings/gdpr");
}
