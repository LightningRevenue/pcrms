"use client";

import { useMemo, useState } from "react";
import { X, ArrowRight, AlertCircle } from "lucide-react";
import type { ImportField } from "@/lib/import-fields";

export function ImportMappingModal({
  headers,
  preview,
  rowCount,
  fields,
  suggestedMapping,
  defaultName,
  onClose,
  onConfirm,
}: {
  headers: string[];
  preview: string[][];
  rowCount: number;
  fields: ImportField[];
  suggestedMapping: Record<string, string | null>;
  defaultName: string;
  onClose: () => void;
  onConfirm: (name: string, mapping: Record<string, string>) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string | null>>(suggestedMapping);
  const [name, setName] = useState(defaultName);

  const usedTargets = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const missingRequired = fields.filter((f) => f.required && !usedTargets.has(f.key));

  function setTarget(header: string, target: string) {
    setMapping((m) => ({ ...m, [header]: target || null }));
  }

  function confirm() {
    const clean: Record<string, string> = {};
    for (const [header, target] of Object.entries(mapping)) {
      if (target) clean[header] = target;
    }
    onConfirm(name.trim() || defaultName, clean);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-2xl max-h-[85vh] bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Map columns</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <label className="block mb-4">
            <span className="text-[12px] text-subtle">Import name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <p className="text-[12px] text-subtle mb-3">
            {rowCount} row{rowCount === 1 ? "" : "s"} detected. Choose which field each column maps to.
          </p>

          <div className="space-y-1.5">
            {headers.map((header, idx) => (
              <div key={header} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate">{header}</p>
                  <p className="text-[11px] text-subtle truncate">
                    {preview.map((r) => r[idx]).filter(Boolean).slice(0, 3).join(", ") || "—"}
                  </p>
                </div>
                <ArrowRight size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                <select
                  value={mapping[header] ?? ""}
                  onChange={(e) => setTarget(header, e.target.value)}
                  className="w-44 shrink-0 text-[13px] outline-none bg-transparent border-b border-border py-0.5 [color-scheme:dark]"
                >
                  <option value="" className="bg-background text-foreground">
                    Don&apos;t import
                  </option>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key} className="bg-background text-foreground">
                      {f.label}
                      {f.required ? " *" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-md bg-amber-500/10 text-amber-400 text-[12px]">
              <AlertCircle size={14} strokeWidth={1.75} className="shrink-0" />
              Map a column to: {missingRequired.map((f) => f.label).join(", ")}
            </div>
          )}
        </div>

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={missingRequired.length > 0}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
