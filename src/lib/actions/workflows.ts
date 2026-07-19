"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TriggerType } from "@/lib/workflow-triggers";

export async function createWorkflow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const workflow = await db.workflow.create({
    data: { name: "Untitled", createdById: session.user.id },
  });

  revalidatePath("/workflows");
  redirect(`/workflows/${workflow.id}`);
}

export async function setWorkflowTrigger(workflowId: string, triggerType: TriggerType) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.workflow.update({
    where: { id: workflowId },
    data: { triggerType },
  });

  revalidatePath(`/workflows/${workflowId}`);
}

export async function renameWorkflow(workflowId: string, name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = name.trim();

  await db.workflow.update({
    where: { id: workflowId },
    data: { name: trimmed || "Untitled" },
  });

  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/workflows");
}

export async function discardWorkflow(workflowId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.workflow.delete({ where: { id: workflowId } });

  revalidatePath("/workflows");
  redirect("/workflows");
}
