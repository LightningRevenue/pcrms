"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

export async function listPlaybooks() {
  const { workspaceId } = await requireWorkspace();
  return db.playbook.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { createdBy: true, sections: { orderBy: { position: "asc" } } },
  });
}

export async function getPlaybook(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.playbook.findUnique({
    where: { id, workspaceId },
    include: { sections: { orderBy: { position: "asc" } } },
  });
}

export type PlaybookSectionInput = { title: string; body: string };
export type PlaybookInput = { title: string; sections: PlaybookSectionInput[] };

export async function createPlaybook(input: PlaybookInput) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "playbooks_feature");
  await assertLimit(workspaceId, "playbooks_count");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const playbook = await db.playbook.create({
    data: {
      workspaceId,
      title,
      createdById: userId,
      sections: {
        create: input.sections.map((s, i) => ({ workspaceId, title: s.title.trim(), body: s.body, position: i })),
      },
    },
  });

  revalidatePath("/settings/playbooks");
  return playbook;
}

export async function updatePlaybook(id: string, input: PlaybookInput) {
  const { workspaceId } = await requireWorkspace();

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  await db.$transaction([
    db.playbookSection.deleteMany({ where: { workspaceId, playbookId: id } }),
    db.playbook.update({
      where: { id, workspaceId },
      data: {
        title,
        sections: {
          create: input.sections.map((s, i) => ({ workspaceId, title: s.title.trim(), body: s.body, position: i })),
        },
      },
    }),
  ]);

  revalidatePath("/settings/playbooks");
}

export async function deletePlaybook(id: string) {
  const { workspaceId } = await requireWorkspace();

  await db.playbook.delete({ where: { id, workspaceId } });
  revalidatePath("/settings/playbooks");
}
