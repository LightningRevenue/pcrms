"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Check, ChevronDown } from "lucide-react";

export type FilterOption = { id: string; label: string; hint?: string };

// Generic multi-select dropdown, OR semantics. Replaces the near-identical
// Owner/Campaign/Mailbox pickers — same shell, different options.
export function FilterPicker({
  label,
  options,
  selected,
  onChange,
  icon: Icon = ListFilter,
  emptyText = "Nothing to filter by.",
  width = "w-56",
  full = false,
  searchable,
  align = "right",
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  icon?: typeof ListFilter;
  emptyText?: string;
  width?: string;
  /** Stretch the trigger to fill its container — for form layouts rather than toolbars. */
  full?: boolean;
  /** Adds a type-to-filter box. Defaults on past ~15 options, where scrolling stops working. */
  searchable?: boolean;
  /** Which edge the menu hangs from. Left keeps it inside a panel when the trigger sits far left. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const showSearch = searchable ?? options.length > 15;
  const visible = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className={full ? "relative" : "relative shrink-0"} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md text-[12.5px] border transition-colors ${
          full ? "w-full px-2.5 py-1.5" : "px-2 py-1"
        } ${
          selected.size > 0
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-subtle hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon size={13} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">
          {full && selected.size > 0
            ? selected.size === 1
              ? (options.find((o) => selected.has(o.id))?.label ?? label)
              : `${selected.size} selected`
            : label}
        </span>
        {!full && selected.size > 0 && (
          <span className="px-1.5 rounded-full bg-accent/15 text-accent text-[11px]">{selected.size}</span>
        )}
        {full && <ChevronDown size={13} strokeWidth={1.75} className="ml-auto shrink-0 opacity-60" />}
      </button>

      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} mt-1.5 ${full ? "w-full min-w-[200px]" : width} border border-border rounded-lg bg-surface shadow-lg z-30 py-1 max-h-80 overflow-auto`}
        >
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[11px] font-medium text-subtle uppercase tracking-wide">{label}</p>
            {selected.size > 0 && (
              <button
                onClick={() => onChange(new Set())}
                className="text-[11px] text-subtle hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {showSearch && options.length > 0 && (
            <div className="px-2 pb-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-2 py-1 text-[12.5px] rounded border border-border bg-transparent outline-none focus:border-accent"
              />
            </div>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-1.5 text-[12.5px] text-subtle">{emptyText}</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-1.5 text-[12.5px] text-subtle">No match.</p>
          ) : (
            visible.map((o) => (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] hover:bg-muted transition-colors text-left"
              >
                <span className="min-w-0 truncate">
                  {o.label}
                  {o.hint && <span className="text-subtle"> · {o.hint}</span>}
                </span>
                {selected.has(o.id) && <Check size={13} strokeWidth={2} className="shrink-0 text-accent" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
