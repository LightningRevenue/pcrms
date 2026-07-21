"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { MAX_FAVORITES } from "@/lib/favorites-event";

export type FavoriteEntityType = "company" | "person" | "opportunity";

export async function listFavorites() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return [];

  return db.favorite.findMany({
    where: { workspaceId: session.user.workspaceId, userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function isFavorited(entityType: FavoriteEntityType, entityId: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return false;

  const existing = await db.favorite.findUnique({
    where: { userId_entityType_entityId: { userId: session.user.id, entityType, entityId }, workspaceId: session.user.workspaceId },
  });
  return !!existing;
}

export async function toggleFavorite(entityType: FavoriteEntityType, entityId: string, name: string, href: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const existing = await db.favorite.findUnique({
    where: { userId_entityType_entityId: { userId, entityType, entityId }, workspaceId },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id, workspaceId } });
    revalidatePath("/", "layout");
    return { favorited: false };
  }

  const count = await db.favorite.count({ where: { workspaceId, userId } });
  if (count >= MAX_FAVORITES) {
    throw new Error(`You can only favorite up to ${MAX_FAVORITES} items. Remove one first.`);
  }

  await db.favorite.create({
    data: { workspaceId, userId, entityType, entityId, name, href },
  });
  revalidatePath("/", "layout");
  return { favorited: true };
}

export async function removeFavorite(id: string) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.favorite.deleteMany({ where: { id, workspaceId, userId } });
  revalidatePath("/", "layout");
}
