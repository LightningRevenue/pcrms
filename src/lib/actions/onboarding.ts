"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

export async function completeOwnerOnboarding(input: { name: string; industry?: string; size?: string }) {
  const { userId, workspaceId, role } = await requireWorkspace();
  if (role !== "owner") throw new Error("Owner access required");

  const name = input.name.trim();
  if (!name) throw new Error("Workspace name is required");

  await db.workspace.update({
    where: { id: workspaceId },
    data: { name, industry: input.industry?.trim() || null, size: input.size?.trim() || null },
  });
  await db.workspaceMember.update({ where: { userId }, data: { onboardedAt: new Date() } });

  redirect("/");
}

export async function completeMemberOnboarding(input: { firstName: string; lastName?: string; title?: string }) {
  const { userId } = await requireWorkspace();

  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("Name is required");

  await db.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName: input.lastName?.trim() || null,
      title: input.title?.trim() || null,
    },
  });
  await db.workspaceMember.update({ where: { userId }, data: { onboardedAt: new Date() } });

  redirect("/");
}
