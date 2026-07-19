"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/workspace-settings";

// The workspace owner is the first user ever created — same convention auth.ts already uses
// to decide who first claimed the workspace's allowed email domain.
async function isOwner(userId: string) {
  const owner = await db.user.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return owner?.id === userId;
}

export async function getNotificationInboxOptions() {
  const [owner, mailboxes, selected] = await Promise.all([
    db.user.findFirst({ orderBy: { id: "asc" }, select: { id: true, email: true, name: true } }),
    db.mailboxAccount.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, email: true },
    }),
    getSetting(SETTING_KEYS.notificationInbox),
  ]);

  const session = await auth();
  const canEdit = !!session?.user?.id && (await isOwner(session.user.id));

  return { owner, mailboxes, selected, canEdit };
}

export async function setNotificationInbox(value: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (!(await isOwner(session.user.id))) throw new Error("Only the workspace owner can change this setting");

  await setSetting(SETTING_KEYS.notificationInbox, value);
}
