"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";

// Names a saved filter view. Sibling of SaveListDialog, but a view stores the *filters* and
// re-evaluates them on every visit, where a list freezes the contacts it was built from.
export function SaveViewDialog({
  defaultName,
  pending,
  onSave,
  onClose,
}: {
  defaultName?: string;
  pending?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) {
      setError("Give the view a name.");
      return;
    }
    setError(null);
    onSave(name.trim());
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent shrink-0">
            <Eye size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Save this view</p>
            <p className="text-[11.5px] text-subtle">Only you see it, unless you share its link</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-4 pb-1">
          <label className="block text-[11px] font-medium text-subtle uppercase tracking-wide mb-1.5">
            View name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="e.g. My open leads in Romania"
            className="w-full px-2.5 py-2 rounded-md border border-border bg-transparent text-[13px] outline-none focus:border-accent placeholder:text-subtle"
          />
          <p className="text-[11.5px] text-subtle mt-2">
            Saves the filters, not the contacts — the list refreshes as your data changes.
          </p>
          {error && <p className="text-[11.5px] text-red-400 mt-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3.5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !name.trim()}
            className="px-3 py-1.5 rounded-md text-[13px] border border-accent text-accent bg-accent/10 hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save view"}
          </button>
        </div>
      </div>
    </div>
  );
}
