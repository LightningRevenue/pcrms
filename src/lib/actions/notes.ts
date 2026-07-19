"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function listNotesForPerson(personId: string) {
  return db.note.findMany({
    where: { personId },
    include: { createdBy: true, opportunities: { include: { opportunity: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listNotesForOpportunity(opportunityId: string) {
  return db.note.findMany({
    where: { opportunities: { some: { opportunityId } } },
    include: { createdBy: true, opportunities: { include: { opportunity: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(personId: string, body: string, opportunityIds?: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note can't be empty");

  await db.note.create({
    data: {
      body: trimmed,
      personId,
      createdById: session.user.id,
      opportunities: opportunityIds?.length
        ? { createMany: { data: opportunityIds.map((opportunityId) => ({ opportunityId })) } }
        : undefined,
    },
  });
  await db.activity.create({
    data: { entityType: "person", entityId: personId, kind: "note_added", field: "Note", actorId: session.user.id },
  });

  revalidatePath(`/contacts/${personId}`);
  if (opportunityIds) for (const id of opportunityIds) revalidatePath(`/deals/${id}`);
}
