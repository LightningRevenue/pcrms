"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { listPlaybooks } from "@/lib/actions/playbooks";

type PlaybookWithSections = Awaited<ReturnType<typeof listPlaybooks>>[number];

export function ContactPlaybooksPanel({ onClose }: { onClose: () => void }) {
  const [playbooks, setPlaybooks] = useState<PlaybookWithSections[] | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  function selectPlaybook(p: PlaybookWithSections) {
    const opening = openId !== p.id;
    setOpenId(opening ? p.id : null);
    setOpenSectionId(opening ? (p.sections[0]?.id ?? null) : null);
  }

  useEffect(() => {
    listPlaybooks().then(setPlaybooks);
  }, []);

  const filtered = useMemo(() => {
    if (!playbooks) return [];
    const q = query.trim().toLowerCase();
    if (!q) return playbooks;
    return playbooks.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.sections.some((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
    );
  }, [playbooks, query]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-40 flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium flex items-center gap-1.5">
            <BookOpen size={14} strokeWidth={1.75} />
            Playbooks
          </span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border">
            <Search size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search playbooks…"
              className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-subtle"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {playbooks === null ? (
            <p className="px-1 text-[13px] text-subtle">Loading playbooks…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen size={22} strokeWidth={1.5} className="text-subtle" />
              <p className="text-[13px] text-subtle mt-2">
                {playbooks.length === 0 ? "No playbooks yet." : "No playbooks match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const open = openId === p.id;
                return (
                  <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => selectPlaybook(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      {open ? (
                        <ChevronDown size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                      ) : (
                        <ChevronRight size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{p.title}</span>
                      <span className="text-[11px] text-subtle shrink-0">{p.sections.length}</span>
                    </button>
                    {open && (
                      <div className="border-t border-border divide-y divide-border">
                        {p.sections.map((s) => {
                          const sectionOpen = openSectionId === s.id;
                          return (
                            <div key={s.id}>
                              <button
                                onClick={() => setOpenSectionId(sectionOpen ? null : s.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                              >
                                {sectionOpen ? (
                                  <ChevronDown size={12} strokeWidth={1.75} className="text-subtle shrink-0" />
                                ) : (
                                  <ChevronRight size={12} strokeWidth={1.75} className="text-subtle shrink-0" />
                                )}
                                <span className="flex-1 min-w-0 text-[12px] font-medium truncate">{s.title}</span>
                              </button>
                              {sectionOpen && (
                                <p className="px-3 pb-2.5 pl-[1.875rem] text-[13px] text-subtle whitespace-pre-wrap">
                                  {s.body}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
