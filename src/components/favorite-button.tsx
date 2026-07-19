"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite, type FavoriteEntityType } from "@/lib/actions/favorites";
import { notifyFavoritesChanged } from "@/lib/favorites-event";

export function FavoriteButton({
  entityType,
  entityId,
  name,
  href,
  initialFavorited,
}: {
  entityType: FavoriteEntityType;
  entityId: string;
  name: string;
  href: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      try {
        await toggleFavorite(entityType, entityId, name, href);
        notifyFavoritesChanged();
      } catch (e) {
        setFavorited(!next);
        alert(e instanceof Error ? e.message : "Failed to update favorite");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
    >
      <Heart
        size={14}
        strokeWidth={1.75}
        className={favorited ? "fill-rose-400 text-rose-400" : "text-subtle"}
      />
    </button>
  );
}
