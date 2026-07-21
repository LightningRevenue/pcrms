"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { restoreFromTrash, purgeFromTrash, type TrashEntityType } from "@/lib/actions/trash";

type TrashItem = { id: string; type: TrashEntityType; label: string; deletedAt: Date };

const TYPE_LABELS: Record<TrashEntityType, string> = {
  company: "Company",
  person: "Contact",
  opportunity: "Opportunity",
};

function daysLeft(deletedAt: Date) {
  const purgeAt = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const days = Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(days, 0);
}

export function TrashManager({ items: initialItems }: { items: TrashItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();

  function handleRestore(item: TrashItem) {
    startTransition(async () => {
      await restoreFromTrash(item.type, item.id);
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.type === item.type)));
    });
  }

  function handlePurge(item: TrashItem) {
    if (!confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await purgeFromTrash(item.type, item.id);
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.type === item.type)));
    });
  }

  if (items.length === 0) {
    return <p className="text-[13px] text-subtle text-center py-8 border border-border rounded-md">Trash is empty</p>;
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {items.map((item) => (
        <div
          key={`${item.type}-${item.id}`}
          className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{item.label || "Untitled"}</div>
            <div className="text-subtle text-[12px]">
              {TYPE_LABELS[item.type]} · {daysLeft(item.deletedAt)} days left
            </div>
          </div>
          <button
            onClick={() => handleRestore(item)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] hover:bg-muted transition-colors shrink-0"
          >
            <RotateCcw size={13} strokeWidth={1.75} />
            Restore
          </button>
          <button
            onClick={() => handlePurge(item)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] text-red-400 hover:bg-red-950/30 transition-colors shrink-0"
          >
            <Trash2 size={13} strokeWidth={1.75} />
            Delete forever
          </button>
        </div>
      ))}
    </div>
  );
}
