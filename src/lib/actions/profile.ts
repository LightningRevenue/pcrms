"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function getMyProfile() {
  const { userId } = await requireWorkspace();

  return db.user.findUniqueOrThrow({ where: { id: userId } });
}

export type ProfileInput = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  phone: string;
  website: string;
  title: string;
  company: string;
};

export async function updateProfile(input: ProfileInput) {
  const { userId } = await requireWorkspace();

  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("First name is required");
  const lastName = input.lastName.trim();

  await db.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" "),
      personalEmail: input.personalEmail.trim() || null,
      phone: input.phone.trim() || null,
      website: input.website.trim() || null,
      title: input.title.trim() || null,
      company: input.company.trim() || null,
    },
  });

  revalidatePath("/settings");
}
