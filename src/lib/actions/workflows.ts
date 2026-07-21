"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { TriggerType } from "@/lib/workflow-triggers";
import { assertLimit } from "@/lib/entitlements";

export async function createWorkflow() {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "workflows_feature");
  await assertLimit(workspaceId, "workflows_count");

  const workflow = await db.workflow.create({
    data: { workspaceId, name: "Untitled", createdById: userId },
  });

  revalidatePath("/workflows");
  redirect(`/workflows/${workflow.id}`);
}

export async function setWorkflowTrigger(workflowId: string, triggerType: TriggerType) {
  const { workspaceId } = await requireWorkspace();

  await db.workflow.update({
    where: { id: workflowId, workspaceId },
    data: { triggerType },
  });

  revalidatePath(`/workflows/${workflowId}`);
}

export async function renameWorkflow(workflowId: string, name: string) {
  const { workspaceId } = await requireWorkspace();

  const trimmed = name.trim();

  await db.workflow.update({
    where: { id: workflowId, workspaceId },
    data: { name: trimmed || "Untitled" },
  });

  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/workflows");
}

export async function discardWorkflow(workflowId: string) {
  const { workspaceId } = await requireWorkspace();

  await db.workflow.delete({ where: { id: workflowId, workspaceId } });

  revalidatePath("/workflows");
  redirect("/workflows");
}
