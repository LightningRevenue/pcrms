"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function listMyMailboxPreferences() {
  const { userId, workspaceId } = await requireWorkspace();

  const [mailboxes, preferences] = await Promise.all([
    db.mailboxAccount.findMany({ where: { workspaceId, active: true }, orderBy: { createdAt: "asc" } }),
    db.userMailboxPreference.findMany({ where: { workspaceId, userId }, select: { mailboxAccountId: true } }),
  ]);

  const selectedIds = new Set(preferences.map((p) => p.mailboxAccountId));
  return mailboxes.map((m) => ({ ...m, selected: selectedIds.has(m.id) }));
}

// The From picker in compose (Unified Inbox, contacts, deals) should only ever offer the
// mailboxes this user has picked in Settings > General — never the whole workspace's list.
export async function listMyMailboxOptions() {
  const { userId, workspaceId } = await requireWorkspace();

  const preferences = await db.userMailboxPreference.findMany({
    where: { workspaceId, userId, mailboxAccount: { active: true } },
    select: { mailboxAccount: { select: { id: true, label: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return preferences.map((p) => p.mailboxAccount);
}

export async function setMailboxPreference(mailboxAccountId: string, selected: boolean) {
  const { userId, workspaceId } = await requireWorkspace();

  if (selected) {
    await db.userMailboxPreference.upsert({
      where: { userId_mailboxAccountId: { userId, mailboxAccountId } },
      create: { workspaceId, userId, mailboxAccountId },
      update: {},
    });
  } else {
    await db.userMailboxPreference.deleteMany({
      where: { workspaceId, userId, mailboxAccountId },
    });
  }

  revalidatePath("/settings/general");
}
