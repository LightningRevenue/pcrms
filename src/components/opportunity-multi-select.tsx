"use client";

import { useRef, useState } from "react";
import { ChevronDown, X, Check, Banknote } from "lucide-react";
import type { Opportunity } from "@prisma/client";

export function OpportunityMultiSelect({
  opportunities,
  selectedIds,
  onChange,
}: {
  opportunities: Opportunity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (opportunities.length === 0) return null;

  const selected = opportunities.filter((o) => selectedIds.includes(o.id));

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 flex-wrap min-h-[30px] px-2 py-1 rounded-md border border-border text-[13px] hover:border-subtle transition-colors"
      >
        <Banknote size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
        {selected.length === 0 ? (
          <span className="text-subtle">Associate with deal…</span>
        ) : (
          selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[12px]"
            >
              {o.name || "Untitled"}
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(o.id);
                }}
                className="hover:text-foreground text-subtle"
              >
                <X size={11} strokeWidth={2} />
              </span>
            </span>
          ))
        )}
        <ChevronDown size={13} strokeWidth={1.75} className="text-subtle ml-auto shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-56 overflow-y-auto">
            {opportunities.map((o) => {
              const checked = selectedIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                >
                  <span className="truncate flex-1 min-w-0 text-left">{o.name || "Untitled"}</span>
                  <span className="text-[11px] text-subtle shrink-0">{o.stage}</span>
                  {checked && <Check size={14} strokeWidth={2} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
