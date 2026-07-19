"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function listMembers() {
  return db.user.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, email: true, image: true } });
}

export type CreateMemberInput = {
  firstName: string;
  lastName: string;
  email: string;
};

export async function createMember(input: CreateMemberInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const firstName = input.firstName.trim();
  const email = input.email.trim().toLowerCase();
  if (!firstName) throw new Error("First name is required");
  if (!email) throw new Error("Email is required");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A member with this email already exists");

  const name = [firstName, input.lastName.trim()].filter(Boolean).join(" ");
  const member = await db.user.create({ data: { name, email } });

  revalidatePath("/settings/members");
  return member;
}
