"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function listWorkspacesForAdmin() {
  await requirePlatformAdmin();

  const workspaces = await db.workspace.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      emailDomain: true,
      createdAt: true,
      suspendedAt: true,
      _count: { select: { members: true } },
    },
  });

  return workspaces;
}

export async function getWorkspaceForAdmin(workspaceId: string) {
  await requirePlatformAdmin();

  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      members: { select: { role: true, onboardedAt: true, user: { select: { id: true, name: true, email: true } } } },
    },
  });

  const [companyCount, personCount, opportunityCount] = await Promise.all([
    db.company.count({ where: { workspaceId, deletedAt: null } }),
    db.person.count({ where: { workspaceId, deletedAt: null } }),
    db.opportunity.count({ where: { workspaceId, deletedAt: null } }),
  ]);

  return { workspace, usage: { companyCount, personCount, opportunityCount } };
}

export async function suspendWorkspace(workspaceId: string) {
  await requirePlatformAdmin();
  await db.workspace.update({ where: { id: workspaceId }, data: { suspendedAt: new Date() } });
  revalidatePath("/admin");
  revalidatePath(`/admin/${workspaceId}`);
}

export async function reactivateWorkspace(workspaceId: string) {
  await requirePlatformAdmin();
  await db.workspace.update({ where: { id: workspaceId }, data: { suspendedAt: null } });
  revalidatePath("/admin");
  revalidatePath(`/admin/${workspaceId}`);
}
