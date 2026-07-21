"use client";

import { useEffect, useRef, useState } from "react";
import { X, UserCircle, Check } from "lucide-react";
import { searchPeople } from "@/lib/actions/contacts";

export function ContactPicker({
  contactId,
  contactName,
  onPick,
  onClear,
  label = "Contact",
  placeholder = "No contact",
}: {
  contactId: string | null;
  contactName: string;
  onPick: (id: string, name: string) => void;
  onClear: () => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => setResults(await searchPeople(query)), 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
          <UserCircle size={14} strokeWidth={1.75} />
          {label}
        </div>
        <span className="flex-1 min-w-0 text-[13px] truncate">
          {contactId ? contactName : <span className="text-subtle">{placeholder}</span>}
        </span>
        {contactId && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-subtle hover:text-foreground transition-colors shrink-0"
          >
            <X size={13} strokeWidth={1.75} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-border rounded-lg bg-surface shadow-lg z-20 py-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
          />
          <div className="max-h-48 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPick(p.id, p.name);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
              >
                <span className="truncate">{p.name}</span>
                {contactId === p.id && <Check size={13} strokeWidth={2} className="shrink-0" />}
              </button>
            ))}
            {query.trim() && results.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-subtle">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
