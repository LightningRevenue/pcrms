"use client";

import { useState } from "react";
import type { Opportunity } from "@prisma/client";
import { Minus, X } from "lucide-react";
import { OpportunityMultiSelect } from "@/components/opportunity-multi-select";

export function CreateNotePanel({
  relatedTo,
  opportunities = [],
  onClose,
  onSave,
}: {
  relatedTo: string;
  opportunities?: Opportunity[];
  onClose: () => void;
  onSave: (body: string, opportunityIds: string[]) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [body, setBody] = useState("");
  const [opportunityIds, setOpportunityIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!body.trim()) {
      setError("Note can't be empty");
      return;
    }
    onSave(body.trim(), opportunityIds);
  }

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 w-[420px] bg-background border border-border border-b-0 rounded-t-lg shadow-2xl flex flex-col ${
        minimized ? "" : "h-[380px]"
      }`}
    >
      <div
        className="h-11 shrink-0 flex items-center justify-between px-4 bg-muted rounded-t-lg cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-[13px] font-medium truncate">New note</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3 flex-1 min-h-0">
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a note…"
              className="w-full h-full resize-none text-[13px] outline-none bg-transparent placeholder:text-subtle"
            />
          </div>

          <div className="px-4 py-2.5 border-t border-border space-y-2">
            <label className="flex items-center gap-2">
              <span className="text-[12px] text-subtle w-14 shrink-0">Related</span>
              <span className="flex-1 min-w-0 text-[13px] truncate">{relatedTo}</span>
            </label>
            {opportunities.length > 0 && (
              <OpportunityMultiSelect
                opportunities={opportunities}
                selectedIds={opportunityIds}
                onChange={setOpportunityIds}
              />
            )}
          </div>

          {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

          <div className="px-4 py-3 border-t border-border flex items-center justify-end shrink-0">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
