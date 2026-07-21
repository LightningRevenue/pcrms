"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

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
  const { workspaceId } = await requireWorkspace();
  const count = await db.pipelineStage.count({ where: { workspaceId } });
  if (count === 0) {
    await db.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({ workspaceId, label: s.label, outcome: s.outcome, order: i })),
    });
  }
  return db.pipelineStage.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
}

export async function createPipelineStage(label: string, outcome: StageOutcome) {
  const { workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "pipeline_stages_count");

  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");

  const last = await db.pipelineStage.findFirst({ where: { workspaceId }, orderBy: { order: "desc" }, select: { order: true } });

  const stage = await db.pipelineStage.create({
    data: { workspaceId, label: trimmed, outcome, order: (last?.order ?? -1) + 1 },
  });

  revalidatePath("/settings/pipeline");
  return stage;
}

export async function updatePipelineStage(id: string, data: { label?: string; outcome?: StageOutcome }) {
  const { workspaceId } = await requireWorkspace();

  const current = await db.pipelineStage.findUniqueOrThrow({ where: { id, workspaceId } });
  const label = data.label?.trim() || current.label;

  await db.pipelineStage.update({ where: { id, workspaceId }, data: { label, outcome: data.outcome ?? current.outcome } });

  if (data.label && data.label.trim() !== current.label) {
    await db.opportunity.updateMany({ where: { workspaceId, stage: current.label }, data: { stage: label } });
  }

  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}

export async function reorderPipelineStages(orderedIds: string[]) {
  const { workspaceId } = await requireWorkspace();

  await Promise.all(orderedIds.map((id, i) => db.pipelineStage.update({ where: { id, workspaceId }, data: { order: i } })));
  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}

export async function countDealsInStage(label: string) {
  const { workspaceId } = await requireWorkspace();
  return db.opportunity.count({ where: { workspaceId, stage: label } });
}

export async function deletePipelineStage(id: string, remapToLabel?: string) {
  const { workspaceId } = await requireWorkspace();

  const stage = await db.pipelineStage.findUniqueOrThrow({ where: { id, workspaceId } });
  const dealsInStage = await db.opportunity.count({ where: { workspaceId, stage: stage.label } });

  if (dealsInStage > 0) {
    if (!remapToLabel) throw new Error("This stage has deals — choose where to move them first");
    const target = await db.pipelineStage.findUniqueOrThrow({ where: { workspaceId_label: { workspaceId, label: remapToLabel } } });
    await db.opportunity.updateMany({
      where: { workspaceId, stage: stage.label },
      data: {
        stage: remapToLabel,
        closeDate: target.outcome === "open" ? null : new Date(),
      },
    });
  }

  await db.pipelineStage.delete({ where: { id, workspaceId } });

  revalidatePath("/settings/pipeline");
  revalidatePath("/deals");
}
