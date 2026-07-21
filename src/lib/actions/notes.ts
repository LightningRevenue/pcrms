"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function listNotesForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.note.findMany({
    where: { workspaceId, personId },
    include: { createdBy: true, opportunities: { include: { opportunity: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listNotesForOpportunity(opportunityId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.note.findMany({
    where: { workspaceId, opportunities: { some: { opportunityId } } },
    include: { createdBy: true, opportunities: { include: { opportunity: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(personId: string, body: string, opportunityIds?: string[]) {
  const { userId, workspaceId } = await requireWorkspace();

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note can't be empty");

  await db.note.create({
    data: {
      workspaceId,
      body: trimmed,
      personId,
      createdById: userId,
      opportunities: opportunityIds?.length
        ? { createMany: { data: opportunityIds.map((opportunityId) => ({ workspaceId, opportunityId })) } }
        : undefined,
    },
  });
  await db.activity.create({
    data: { workspaceId, entityType: "person", entityId: personId, kind: "note_added", field: "Note", actorId: userId },
  });

  revalidatePath(`/contacts/${personId}`);
  if (opportunityIds) for (const id of opportunityIds) revalidatePath(`/deals/${id}`);
}
