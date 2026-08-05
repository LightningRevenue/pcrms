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
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 6, left: r.left });
    } else {
      setQuery("");
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
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Search (⌘K)"
        className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <Search size={15} strokeWidth={1.75} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: rect.top, left: rect.left }}
            className="fixed z-[100] w-72 rounded-md border border-border bg-background shadow-lg"
          >
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border text-subtle">
              <Search size={14} strokeWidth={1.75} className="shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent outline-none text-[13px] placeholder:text-subtle text-foreground"
              />
              <kbd className="shrink-0 rounded border border-border px-1 text-[10px] font-medium">⌘K</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
            {!query.trim() ? (
              <div className="px-3 py-3 text-[12px] text-subtle text-center">Type to search…</div>
            ) : results.length === 0 ? (
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
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
