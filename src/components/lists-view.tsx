"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { List, User } from "@prisma/client";
import { List as ListIcon, Building2, Users, Banknote, ChevronDown, Plus, Trash2 } from "lucide-react";
import { createList, deleteList, type ListEntityType } from "@/lib/actions/lists";

type ListRow = List & { createdBy: User | null; _count: { items: number } };

const ENTITY_TYPES: { value: ListEntityType; label: string; icon: typeof Building2; color: string }[] = [
  { value: "company", label: "Companies", icon: Building2, color: "text-blue-400" },
  { value: "person", label: "People", icon: Users, color: "text-violet-400" },
  { value: "opportunity", label: "Deals", icon: Banknote, color: "text-rose-400" },
];

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ListsView({ lists: initial }: { lists: ListRow[] }) {
  const [lists, setLists] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<ListEntityType>("company");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const list = await createList(name, entityType);
        setCreating(false);
        setName("");
        router.push(`/lists/${list.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This removes the list and its members.`)) return;
    setLists((prev) => prev.filter((l) => l.id !== id));
    startTransition(() => deleteList(id));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <ListIcon size={14} strokeWidth={1.75} className="text-subtle" />
          <span className="font-medium">Lists</span>
        </div>
        {creating ? (
          <div className="flex items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as ListEntityType)}
              className="px-2.5 py-1 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="List name"
              className="px-2.5 py-1 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={pending}
              className="px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-2.5 py-1 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            New List
          </button>
        )}
      </div>

      {error && (
        <div className="px-6 py-1.5 border-b border-border">
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <ListIcon size={14} strokeWidth={1.75} />
          All Lists
          <span className="text-subtle">· {lists.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <ListIcon size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No lists yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {lists.map((l) => {
              const type = ENTITY_TYPES.find((t) => t.value === l.entityType) ?? ENTITY_TYPES[0];
              const Icon = type.icon;
              return (
                <Link
                  key={l.id}
                  href={`/lists/${l.id}`}
                  className="flex items-center gap-6 px-6 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${type.color}`} />
                    <span className="text-[13px] truncate">{l.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-muted text-subtle">
                      {type.label}
                    </span>
                  </span>
                  <span className="text-[12px] text-subtle shrink-0">{l._count.items} items</span>
                  <span className="text-[12px] text-subtle shrink-0 w-20 text-right">{relativeTime(l.createdAt)}</span>
                  <button
                    onClick={(e) => handleDelete(e, l.id, l.name)}
                    title="Delete list"
                    className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
