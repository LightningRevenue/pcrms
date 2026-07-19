"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Check } from "lucide-react";
import { searchEntitiesForList, addToList, removeFromList } from "@/lib/actions/lists";

type Row = { id: string; name: string; subtitle: string | null; alreadyInList: boolean };

export function AddToListModal({ listId, onClose }: { listId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    searchEntitiesForList(listId, query).then(setRows);
  }, [listId, query]);

  function toggle(row: Row) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, alreadyInList: !r.alreadyInList } : r)));
    startTransition(async () => {
      if (row.alreadyInList) {
        await removeFromList(listId, row.id);
      } else {
        await addToList(listId, row.id);
      }
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[70vh] flex flex-col rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Add to list</span>
          <button onClick={onClose} className="p-1 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border">
            <Search size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 min-w-0 text-[13px] outline-none bg-transparent placeholder:text-subtle"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {rows.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-8">No results.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggle(r)}
                  disabled={pending}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
                >
                  <span
                    className={`size-4 shrink-0 rounded border flex items-center justify-center ${
                      r.alreadyInList ? "bg-accent border-accent" : "border-border"
                    }`}
                  >
                    {r.alreadyInList && <Check size={12} strokeWidth={2.5} className="text-white" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">{r.name || "Untitled"}</p>
                    {r.subtitle && <p className="text-[12px] text-subtle truncate">{r.subtitle}</p>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
