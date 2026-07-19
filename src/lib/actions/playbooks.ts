"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function listPlaybooks() {
  return db.playbook.findMany({
    orderBy: { updatedAt: "desc" },
    include: { createdBy: true, sections: { orderBy: { position: "asc" } } },
  });
}

export async function getPlaybook(id: string) {
  return db.playbook.findUnique({
    where: { id },
    include: { sections: { orderBy: { position: "asc" } } },
  });
}

export type PlaybookSectionInput = { title: string; body: string };
export type PlaybookInput = { title: string; sections: PlaybookSectionInput[] };

export async function createPlaybook(input: PlaybookInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const playbook = await db.playbook.create({
    data: {
      title,
      createdById: session.user.id,
      sections: {
        create: input.sections.map((s, i) => ({ title: s.title.trim(), body: s.body, position: i })),
      },
    },
  });

  revalidatePath("/settings/playbooks");
  return playbook;
}

export async function updatePlaybook(id: string, input: PlaybookInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  await db.$transaction([
    db.playbookSection.deleteMany({ where: { playbookId: id } }),
    db.playbook.update({
      where: { id },
      data: {
        title,
        sections: {
          create: input.sections.map((s, i) => ({ title: s.title.trim(), body: s.body, position: i })),
        },
      },
    }),
  ]);

  revalidatePath("/settings/playbooks");
}

export async function deletePlaybook(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.playbook.delete({ where: { id } });
  revalidatePath("/settings/playbooks");
}
