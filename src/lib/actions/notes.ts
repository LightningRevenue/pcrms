"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";
import { parseMentionedUserIds, notifyMentionedUsers } from "@/lib/note-mentions";

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
  await assertLimit(workspaceId, "notes_count");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note can't be empty");

  const [note, author, members] = await Promise.all([
    db.note.create({
      data: {
        workspaceId,
        body: trimmed,
        personId,
        createdById: userId,
        opportunities: opportunityIds?.length
          ? { createMany: { data: opportunityIds.map((opportunityId) => ({ workspaceId, opportunityId })) } }
          : undefined,
      },
    }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.workspaceMember.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  await db.activity.create({
    data: { workspaceId, entityType: "person", entityId: personId, kind: "note_added", field: "Note", actorId: userId },
  });

  const mentionable = members
    .map((m) => m.user)
    .filter((u): u is { id: string; name: string | null; email: string | null } => !!(u.name ?? u.email))
    .map((u) => ({ userId: u.id, name: u.name ?? u.email ?? "" }));
  const mentionedUserIds = parseMentionedUserIds(trimmed, mentionable);
  await notifyMentionedUsers({
    noteId: note.id,
    noteBody: trimmed,
    personId,
    mentionedByUserId: userId,
    mentionedByName: author?.name ?? author?.email ?? "Someone",
    workspaceId,
    userIds: mentionedUserIds,
  });

  revalidatePath(`/contacts/${personId}`);
  if (opportunityIds) for (const id of opportunityIds) revalidatePath(`/deals/${id}`);
}
