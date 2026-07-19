"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Building2, Users } from "lucide-react";
import { searchWorkspace, type WorkspaceSearchResult } from "@/lib/actions/search";

const ICONS = { company: Building2, person: Users } as const;
const COLORS = { company: "text-blue-400", person: "text-violet-400" } as const;

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    searchWorkspace(q).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (inputRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goTo(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-[13px] text-subtle focus-within:text-foreground focus-within:border-accent transition-colors">
        <Search size={15} strokeWidth={1.75} className="shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search"
          className="w-full bg-transparent outline-none placeholder:text-subtle text-foreground"
        />
      </div>

      {open &&
        rect &&
        query.trim() &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: rect.top, left: rect.left, width: rect.width }}
            className="fixed z-[100] rounded-md border border-border bg-background shadow-lg max-h-80 overflow-y-auto py-1"
          >
            {results.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-subtle text-center">No results</div>
            ) : (
              results.map((r) => {
                const Icon = ICONS[r.kind];
                return (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onClick={() => goTo(r.href)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted transition-colors"
                  >
                    <Icon size={15} strokeWidth={1.75} className={`${COLORS[r.kind]} shrink-0`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] truncate">{r.label}</span>
                      <span className="block text-[11px] text-subtle truncate">{r.sublabel}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </>
  );
}
