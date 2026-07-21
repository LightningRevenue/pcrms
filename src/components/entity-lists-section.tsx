"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { List } from "@prisma/client";
import { List as ListIcon, Plus, ArrowUpRight, Check } from "lucide-react";
import { addToList, removeFromList, listAvailableListsForEntity, type ListEntityType } from "@/lib/actions/lists";

export function EntityListsSection({
  entityType,
  entityId,
  lists: initialLists,
}: {
  entityType: ListEntityType;
  entityId: string;
  lists: List[];
}) {
  const [lists, setLists] = useState(initialLists);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setLists(initialLists), [initialLists]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-medium">Lists</span>
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className="text-subtle hover:text-foreground transition-colors">
            <Plus size={15} strokeWidth={1.75} />
          </button>
          {open && (
            <ListPicker
              entityType={entityType}
              entityId={entityId}
              onChange={(list, inList) =>
                setLists((prev) => (inList ? [...prev, list].sort((a, b) => a.name.localeCompare(b.name)) : prev.filter((l) => l.id !== list.id)))
              }
            />
          )}
        </div>
      </div>

      {lists.length > 0 && (
        <div className="space-y-0.5">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/lists/${l.id}`}
              className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] hover:bg-muted transition-colors group"
            >
              <ListIcon size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
              <span className="truncate flex-1 min-w-0">{l.name}</span>
              <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type AvailableList = { id: string; name: string; inList: boolean };

function ListPicker({
  entityType,
  entityId,
  onChange,
}: {
  entityType: ListEntityType;
  entityId: string;
  onChange: (list: { id: string; name: string; createdAt: Date; entityType: string; createdById: string | null; workspaceId: string }, inList: boolean) => void;
}) {
  const [available, setAvailable] = useState<AvailableList[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    listAvailableListsForEntity(entityType, entityId).then(setAvailable);
  }, [entityType, entityId]);

  function toggle(list: AvailableList) {
    const nextInList = !list.inList;
    setAvailable((prev) => prev.map((l) => (l.id === list.id ? { ...l, inList: nextInList } : l)));
    onChange({ id: list.id, name: list.name, createdAt: new Date(), entityType, createdById: null, workspaceId: "" }, nextInList);
    startTransition(async () => {
      if (nextInList) await addToList(list.id, entityId);
      else await removeFromList(list.id, entityId);
      router.refresh();
    });
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-72 overflow-auto">
      {available.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-subtle">No lists yet.</p>
      ) : (
        available.map((l) => (
          <button
            key={l.id}
            onClick={() => toggle(l)}
            disabled={pending}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors disabled:opacity-60"
          >
            <span className="truncate">{l.name}</span>
            {l.inList && <Check size={13} strokeWidth={2} className="shrink-0" />}
          </button>
        ))
      )}
    </div>
  );
}
