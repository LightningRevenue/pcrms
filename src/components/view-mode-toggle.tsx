"use client";

import { LayoutList, Columns3 } from "lucide-react";
import { useViewMode, setViewMode, type ViewMode } from "@/lib/view-mode";

const OPTIONS: { key: ViewMode; label: string; description: string; icon: typeof LayoutList }[] = [
  {
    key: "simple",
    label: "Simple View",
    description: "Contacts open on a single-column page, same as always.",
    icon: LayoutList,
  },
  {
    key: "advanced",
    label: "Advanced View",
    description: "Contacts open on a 3-column layout with quick actions, relationships, and pipeline stage all visible at once.",
    icon: Columns3,
  },
];

export function ViewModeToggle() {
  const mode = useViewMode();

  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setViewMode(opt.key)}
          className={`text-left rounded-md border p-3 transition-colors ${
            mode === opt.key ? "border-accent bg-accent/5" : "border-border hover:border-subtle"
          }`}
        >
          <div className="flex items-center gap-2">
            <opt.icon size={15} strokeWidth={1.75} className={mode === opt.key ? "text-accent" : "text-subtle"} />
            <span className="text-[13px] font-medium">{opt.label}</span>
          </div>
          <p className="text-[12px] text-subtle mt-1">{opt.description}</p>
        </button>
      ))}
    </div>
  );
}
