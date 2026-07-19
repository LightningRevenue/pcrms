"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type StageOutcome = "open" | "won" | "lost";

const DEFAULT_STAGES: { label: string; outcome: StageOutcome }[] = [
  { label: "New", outcome: "open" },
  { label: "Screening", outcome: "open" },
  { label: "Meeting", outcome: "open" },
  { label: "Proposal", outcome: "open" },
  { label: "Customer", outcome: "won" },
];

// ponytail: seeds the legacy 5-stage list on first read so existing opportunities keep resolving. Remove once every workspace has been migrated.
export async function listPipelineStages() {
  const count = await db.pipelineStage.count();
  if (count === 0) {
    await db.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({ label: s.label, outcome: s.outcome, order: i })),
    });
  }
  return db.pipelineStage.findMany({ orderBy: { order: "asc" } });
}

export async function createPipelineStage(label: string, outcome: StageOutcome) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");

  const last = await db.pipelineStage.findFirst({ orderBy: { order: "desc" }, select: { order: true } });

  const stage = await db.pipelineStage.create({
    data: { label: trimmed, outcome, order: (last?.order ?? -1) + 1 },
  });

  revalidatePath("/settings/pipeline");
  return stage;
}

export async function updatePipelineStage(id: string, data: { label?: string; outcome?: StageOutcome }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const current = await db.pipelineStage.findUniqueOrThrow({ where: { id } });
  const label = data.label?.trim() || current.label;

  await db.pipelineStage.update({ where: { id }, data: { label, outcome: data.outcome ?? current.outcome } });

  if (data.label && data.label.trim() !== current.label) {
    await db.opportunity.updateMany({ where: { stage: current.label }, data: { stage: label } });
  }

  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}

export async function reorderPipelineStages(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await Promise.all(orderedIds.map((id, i) => db.pipelineStage.update({ where: { id }, data: { order: i } })));
  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}

export async function countDealsInStage(label: string) {
  return db.opportunity.count({ where: { stage: label } });
}

export async function deletePipelineStage(id: string, remapToLabel?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const stage = await db.pipelineStage.findUniqueOrThrow({ where: { id } });
  const dealsInStage = await db.opportunity.count({ where: { stage: stage.label } });

  if (dealsInStage > 0) {
    if (!remapToLabel) throw new Error("This stage has deals — choose where to move them first");
    const target = await db.pipelineStage.findUniqueOrThrow({ where: { label: remapToLabel } });
    await db.opportunity.updateMany({
      where: { stage: stage.label },
      data: {
        stage: remapToLabel,
        closeDate: target.outcome === "open" ? null : new Date(),
      },
    });
  }

  await db.pipelineStage.delete({ where: { id } });

  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}
