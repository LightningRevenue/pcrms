"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function listMyMailboxPreferences() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [mailboxes, preferences] = await Promise.all([
    db.mailboxAccount.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    db.userMailboxPreference.findMany({ where: { userId: session.user.id }, select: { mailboxAccountId: true } }),
  ]);

  const selectedIds = new Set(preferences.map((p) => p.mailboxAccountId));
  return mailboxes.map((m) => ({ ...m, selected: selectedIds.has(m.id) }));
}

// The From picker in compose (Unified Inbox, contacts, deals) should only ever offer the
// mailboxes this user has picked in Settings > General — never the whole workspace's list.
export async function listMyMailboxOptions() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const preferences = await db.userMailboxPreference.findMany({
    where: { userId: session.user.id, mailboxAccount: { active: true } },
    select: { mailboxAccount: { select: { id: true, label: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return preferences.map((p) => p.mailboxAccount);
}

export async function setMailboxPreference(mailboxAccountId: string, selected: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  if (selected) {
    await db.userMailboxPreference.upsert({
      where: { userId_mailboxAccountId: { userId: session.user.id, mailboxAccountId } },
      create: { userId: session.user.id, mailboxAccountId },
      update: {},
    });
  } else {
    await db.userMailboxPreference.deleteMany({
      where: { userId: session.user.id, mailboxAccountId },
    });
  }

  revalidatePath("/settings/general");
}
