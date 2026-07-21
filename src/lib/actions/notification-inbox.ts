"use server";

import { auth } from "@/lib/auth";
import { requireWorkspaceOwner } from "@/lib/workspace";
import { db } from "@/lib/db";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/workspace-settings";

export async function getNotificationInboxOptions() {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;

  const [owner, mailboxes, selected] = await Promise.all([
    workspaceId
      ? db.workspaceMember
          .findFirst({ where: { workspaceId, role: "owner" }, select: { user: { select: { id: true, email: true, name: true } } } })
          .then((m) => m?.user ?? null)
      : null,
    workspaceId
      ? db.mailboxAccount.findMany({
          where: { workspaceId, active: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, label: true, email: true },
        })
      : [],
    workspaceId ? getSetting(SETTING_KEYS.notificationInbox, workspaceId) : null,
  ]);

  const canEdit = session?.user?.role === "owner";

  return { owner, mailboxes, selected, canEdit };
}

export async function setNotificationInbox(value: string) {
  const { workspaceId } = await requireWorkspaceOwner();
  await setSetting(SETTING_KEYS.notificationInbox, value, workspaceId);
}
