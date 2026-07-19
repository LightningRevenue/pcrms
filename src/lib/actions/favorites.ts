"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_FAVORITES } from "@/lib/favorites-event";

export type FavoriteEntityType = "company" | "person" | "opportunity";

export async function listFavorites() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function isFavorited(entityType: FavoriteEntityType, entityId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const existing = await db.favorite.findUnique({
    where: { userId_entityType_entityId: { userId: session.user.id, entityType, entityId } },
  });
  return !!existing;
}

export async function toggleFavorite(entityType: FavoriteEntityType, entityId: string, name: string, href: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const existing = await db.favorite.findUnique({
    where: { userId_entityType_entityId: { userId: session.user.id, entityType, entityId } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    revalidatePath("/", "layout");
    return { favorited: false };
  }

  const count = await db.favorite.count({ where: { userId: session.user.id } });
  if (count >= MAX_FAVORITES) {
    throw new Error(`You can only favorite up to ${MAX_FAVORITES} items. Remove one first.`);
  }

  await db.favorite.create({
    data: { userId: session.user.id, entityType, entityId, name, href },
  });
  revalidatePath("/", "layout");
  return { favorited: true };
}

export async function removeFavorite(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.favorite.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/", "layout");
}
