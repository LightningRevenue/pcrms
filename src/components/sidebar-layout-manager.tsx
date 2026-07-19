"use client";

import { useEffect, useState } from "react";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { NAV_ITEMS, defaultLayout, loadLayout, saveLayout, type SidebarLayout } from "@/lib/sidebar-nav";

const SECTION_LABELS = { main: "Workspace", automation: "Workflows" } as const;

export function SidebarLayoutManager() {
  const [layout, setLayout] = useState<SidebarLayout>(defaultLayout);
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => setLayout(loadLayout()), []);

  function update(next: SidebarLayout) {
    setLayout(next);
    saveLayout(next);
  }

  function reorder(draggedKey: string, overKey: string) {
    if (draggedKey === overKey) return;
    const next = [...layout];
    const from = next.findIndex((l) => l.key === draggedKey);
    const to = next.findIndex((l) => l.key === overKey);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
  }

  function toggleHidden(key: string) {
    update(layout.map((l) => (l.key === key ? { ...l, hidden: !l.hidden } : l)));
  }

  const byKey = new Map(NAV_ITEMS.map((i) => [i.key, i]));
  const main = layout.filter((l) => byKey.get(l.key)?.section === "main");
  const automation = layout.filter((l) => byKey.get(l.key)?.section === "automation");

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-subtle">Drag to reorder, click the eye to hide an item from the sidebar.</p>
        <button
          onClick={() => update(defaultLayout())}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
          Reset
        </button>
      </div>

      {([["main", main], ["automation", automation]] as const).map(([section, rows]) =>
        rows.length === 0 ? null : (
          <div key={section}>
            <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">
              {SECTION_LABELS[section]}
            </p>
            <div className="border border-border rounded-md overflow-hidden">
              {rows.map((row) => {
                const item = byKey.get(row.key)!;
                return (
                  <div
                    key={row.key}
                    draggable
                    onDragStart={() => setDragKey(row.key)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragKey) reorder(dragKey, row.key);
                    }}
                    onDragEnd={() => setDragKey(null)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-[13px] border-b border-border last:border-b-0 ${
                      dragKey === row.key ? "opacity-40" : ""
                    } ${row.hidden ? "text-subtle" : ""}`}
                  >
                    <GripVertical
                      size={14}
                      strokeWidth={1.75}
                      className="opacity-40 shrink-0 cursor-grab active:cursor-grabbing"
                    />
                    <span className="flex-1">{item.label}</span>
                    <button
                      onClick={() => toggleHidden(row.key)}
                      title={row.hidden ? "Show in sidebar" : "Hide from sidebar"}
                      className="p-1 rounded text-subtle hover:text-foreground transition-colors"
                    >
                      {row.hidden ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
