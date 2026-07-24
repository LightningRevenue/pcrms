"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Check } from "lucide-react";

export type CampaignOption = { id: string; name: string };

// Shared between /contacts and /deals — multi-select campaign filter, OR semantics
// (matches any selected campaign). Mirrors OwnerFilterPicker's shape.
export function CampaignFilterPicker({
  campaigns,
  selected,
  onChange,
}: {
  campaigns: CampaignOption[];
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

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
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
        Campaign
        {selected.size > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[11px]">{selected.size}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-96 overflow-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[11px] font-medium text-subtle uppercase tracking-wide">Campaign</p>
            {selected.size > 0 && (
              <button onClick={() => onChange(new Set())} className="text-[11px] text-subtle hover:text-foreground transition-colors">
                Clear
              </button>
            )}
          </div>
          {campaigns.length === 0 ? (
            <p className="px-3 py-1.5 text-[13px] text-subtle">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
              >
                <span className="truncate">{c.name}</span>
                {selected.has(c.id) && <Check size={14} strokeWidth={2} className="shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
