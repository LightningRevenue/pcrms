"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export type ContactStageOutcome = "open" | "won" | "lost";

// No seeded defaults — unlike listPipelineStages, a workspace only gets stages once someone
// actually defines them in Settings, so /contacts' Kanban stays a plain "no stages yet" empty
// state instead of silently seeding a 5-stage guess that may not fit how they track contacts.
export async function listContactPipelineStages() {
  const { workspaceId } = await requireWorkspace();
  return db.contactPipelineStage.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
}

export async function createContactPipelineStage(label: string, outcome: ContactStageOutcome) {
  const { workspaceId } = await requireWorkspace();

  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");

  const last = await db.contactPipelineStage.findFirst({ where: { workspaceId }, orderBy: { order: "desc" }, select: { order: true } });

  const stage = await db.contactPipelineStage.create({
    data: { workspaceId, label: trimmed, outcome, order: (last?.order ?? -1) + 1 },
  });

  revalidatePath("/settings/contacts-pipeline");
  return stage;
}

export async function updateContactPipelineStage(id: string, data: { label?: string; outcome?: ContactStageOutcome }) {
  const { workspaceId } = await requireWorkspace();

  const current = await db.contactPipelineStage.findUniqueOrThrow({ where: { id, workspaceId } });
  const label = data.label?.trim() || current.label;

  await db.contactPipelineStage.update({ where: { id, workspaceId }, data: { label, outcome: data.outcome ?? current.outcome } });

  if (data.label && data.label.trim() !== current.label) {
    await db.person.updateMany({ where: { workspaceId, stage: current.label }, data: { stage: label } });
  }

  revalidatePath("/settings/contacts-pipeline");
  revalidatePath("/contacts");
}

export async function reorderContactPipelineStages(orderedIds: string[]) {
  const { workspaceId } = await requireWorkspace();

  await Promise.all(orderedIds.map((id, i) => db.contactPipelineStage.update({ where: { id, workspaceId }, data: { order: i } })));
  revalidatePath("/settings/contacts-pipeline");
  revalidatePath("/contacts");
}

export async function countContactsInStage(label: string) {
  const { workspaceId } = await requireWorkspace();
  return db.person.count({ where: { workspaceId, stage: label, deletedAt: null } });
}

export async function deleteContactPipelineStage(id: string, remapToLabel?: string) {
  const { workspaceId } = await requireWorkspace();

  const stage = await db.contactPipelineStage.findUniqueOrThrow({ where: { id, workspaceId } });
  const contactsInStage = await db.person.count({ where: { workspaceId, stage: stage.label, deletedAt: null } });

  if (contactsInStage > 0) {
    if (!remapToLabel) throw new Error("This stage has contacts — choose where to move them first");
    await db.contactPipelineStage.findUniqueOrThrow({ where: { workspaceId_label: { workspaceId, label: remapToLabel } } });
    await db.person.updateMany({ where: { workspaceId, stage: stage.label }, data: { stage: remapToLabel } });
  }

  await db.contactPipelineStage.delete({ where: { id, workspaceId } });

  revalidatePath("/settings/contacts-pipeline");
  revalidatePath("/contacts");
}

export async function moveContactStage(personId: string, stage: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const current = await db.person.findUniqueOrThrow({ where: { id: personId, workspaceId } });
  if (current.stage === stage) return;

  await db.person.update({ where: { id: personId, workspaceId }, data: { stage } });

  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: personId,
      kind: "stage_changed",
      field: "Stage",
      oldValue: current.stage,
      newValue: stage,
      actorId: userId,
    },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${personId}`);
  revalidatePath(`/lead/${personId}`);
}
