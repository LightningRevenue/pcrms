"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function listNotifications() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return [];

  return db.notification.findMany({
    where: { workspaceId: session.user.workspaceId, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function markNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return;

  await db.notification.updateMany({
    where: { workspaceId: session.user.workspaceId, userId: session.user.id, read: false },
    data: { read: true },
  });
}

export async function deleteNotification(id: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return;

  await db.notification.deleteMany({ where: { id, workspaceId: session.user.workspaceId, userId: session.user.id } });
}

export async function clearNotifications() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return;

  await db.notification.deleteMany({ where: { workspaceId: session.user.workspaceId, userId: session.user.id } });
}
