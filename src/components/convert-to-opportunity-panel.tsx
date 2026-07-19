"use client";

import { useState } from "react";
import type { PipelineStage } from "@prisma/client";
import { Minus, X } from "lucide-react";
import type { OpportunityStage } from "@/lib/actions/opportunities";

export type NewOpportunityDraft = {
  name: string;
  stage: OpportunityStage;
  value: number;
};

export function ConvertToOpportunityPanel({
  contactName,
  companyName,
  stages,
  onClose,
  onCreate,
}: {
  contactName: string;
  companyName: string | null;
  stages: PipelineStage[];
  onClose: () => void;
  onCreate: (draft: NewOpportunityDraft) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [name, setName] = useState(`${contactName}'s deal`);
  const [stage, setStage] = useState<OpportunityStage>(stages[0]?.label ?? "");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!name.trim()) {
      setError("Add a deal name");
      return;
    }
    onCreate({ name: name.trim(), stage, value: Math.max(0, Number(value) || 0) });
    onClose();
  }

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 w-[400px] bg-background border border-border border-b-0 rounded-t-lg shadow-2xl flex flex-col ${
        minimized ? "" : "h-[420px]"
      }`}
    >
      <div
        className="h-11 shrink-0 flex items-center justify-between px-4 bg-muted rounded-t-lg cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-[13px] font-medium truncate">Convert to Opportunity</span>
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
          <div className="px-4 py-3 flex-1 min-h-0 space-y-3 overflow-y-auto">
            <label className="block">
              <span className="text-[12px] text-subtle">Deal name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1"
              />
            </label>

            <label className="block">
              <span className="text-[12px] text-subtle">Stage</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as OpportunityStage)}
                className="mt-1 w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.label} className="bg-background text-foreground">
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] text-subtle">Amount</span>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="mt-1 w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1 placeholder:text-subtle"
              />
            </label>

            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-[11px] font-medium text-subtle uppercase tracking-wide">Auto-mapped</p>
              <p className="text-[13px]">
                <span className="text-subtle">Point of contact </span>
                {contactName}
              </p>
              <p className="text-[13px]">
                <span className="text-subtle">Company </span>
                {companyName ?? "—"}
              </p>
            </div>
          </div>

          {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

          <div className="px-4 py-3 border-t border-border flex items-center justify-end shrink-0">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Create opportunity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
