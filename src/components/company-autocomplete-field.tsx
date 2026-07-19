"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { searchCompanies } from "@/lib/actions/companies";

export function CompanyAutocompleteField({
  value,
  onSelect,
  showLabel = true,
}: {
  value: string;
  onSelect: (company: { id: string } | { name: string } | null) => Promise<void>;
  showLabel?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handle = setTimeout(async () => {
      setResults(await searchCompanies(query));
    }, 150);
    return () => clearTimeout(handle);
  }, [query, editing]);

  useEffect(() => {
    if (!editing) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [editing, value]);

  function pick(company: { id: string } | { name: string } | null) {
    setEditing(false);
    startTransition(() => onSelect(company));
  }

  const exactMatch = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      {showLabel && (
        <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle truncate">
          <Building2 size={14} strokeWidth={1.75} />
          Company
        </div>
      )}

      {editing ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company"
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-b border-border placeholder:text-subtle"
        />
      ) : (
        <button
          onClick={() => {
            setQuery(value);
            setEditing(true);
          }}
          className={`flex-1 min-w-0 text-left text-[13px] truncate ${!value ? "text-subtle" : ""} ${pending ? "opacity-50" : ""}`}
        >
          {value || "Empty"}
        </button>
      )}

      {editing && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-56 overflow-y-auto">
          {value && (
            <button
              onClick={() => pick(null)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-subtle hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => pick({ id: c.id })}
              className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
            >
              {c.name}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              onClick={() => pick({ name: query.trim() })}
              className="w-full text-left px-3 py-1.5 text-[13px] text-accent hover:bg-muted transition-colors truncate"
            >
              Create &quot;{query.trim()}&quot;
            </button>
          )}
          {!query.trim() && results.length === 0 && (
            <p className="px-3 py-1.5 text-[12px] text-subtle">Type to search…</p>
          )}
        </div>
      )}
    </div>
  );
}
