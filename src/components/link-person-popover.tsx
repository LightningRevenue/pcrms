"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { searchPeople } from "@/lib/actions/contacts";
import { linkPersonToCompany } from "@/lib/actions/companies";

export function LinkPersonPopover({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [, startTransition] = useTransition();
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

  function pick(personId: string) {
    setOpen(false);
    setQuery("");
    startTransition(() => linkPersonToCompany(companyId, personId));
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="text-subtle hover:text-foreground transition-colors">
        <Plus size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
          />
          <div className="max-h-48 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
              >
                {p.name}
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
