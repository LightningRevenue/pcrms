"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Check } from "lucide-react";

export const NO_OWNER_KEY = "no-owner";

export type WorkspaceUser = { id: string; name: string | null; email: string | null };

// Shared between /contacts and /deals — multi-select owner filter with "No owner" as a
// synthetic id alongside real user ids, OR semantics (matches any selected owner).
export function OwnerFilterPicker({
  users,
  selected,
  onChange,
}: {
  users: WorkspaceUser[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] transition-colors ${
          selected.size > 0 ? "text-accent" : "text-subtle hover:bg-muted hover:text-foreground"
        }`}
      >
        <ListFilter size={14} strokeWidth={1.75} />
        Filter
        {selected.size > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[11px]">{selected.size}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-96 overflow-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[11px] font-medium text-subtle uppercase tracking-wide">Owner</p>
            {selected.size > 0 && (
              <button onClick={() => onChange(new Set())} className="text-[11px] text-subtle hover:text-foreground transition-colors">
                Clear
              </button>
            )}
          </div>
          <button
            onClick={() => toggle(NO_OWNER_KEY)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
          >
            <span className="text-subtle">No owner</span>
            {selected.has(NO_OWNER_KEY) && <Check size={14} strokeWidth={2} />}
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
            >
              <span className="truncate">{u.name ?? u.email}</span>
              {selected.has(u.id) && <Check size={14} strokeWidth={2} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
