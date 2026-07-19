"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getMyProfile() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return db.user.findUniqueOrThrow({ where: { id: session.user.id } });
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("First name is required");
  const lastName = input.lastName.trim();

  await db.user.update({
    where: { id: session.user.id },
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
