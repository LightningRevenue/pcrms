"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";

export function VerifyMappingModal({
  headers,
  preview,
  rowCount,
  suggestedColumn,
  defaultName,
  busy,
  onClose,
  onConfirm,
}: {
  headers: string[];
  preview: string[][];
  rowCount: number;
  suggestedColumn: string | null;
  defaultName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (name: string, emailColumn: string, tags: string[]) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [emailColumn, setEmailColumn] = useState(suggestedColumn ?? "");
  const [tagText, setTagText] = useState("");

  const selectedIdx = headers.indexOf(emailColumn);
  const samples =
    selectedIdx === -1 ? [] : preview.map((r) => r[selectedIdx]).filter(Boolean).slice(0, 3);
  // Guards against mapping a column of names or company records — the whole batch would come
  // back invalid and burn one API call per row before anyone noticed.
  const looksWrong = selectedIdx !== -1 && samples.length > 0 && !samples.some((s) => s.includes("@"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-lg max-h-[85vh] bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Set up verification</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <label className="block">
            <span className="text-[12px] text-subtle">Batch name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-[12px] text-subtle">Which column holds the email addresses?</span>
            <select
              value={emailColumn}
              onChange={(e) => setEmailColumn(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
            >
              <option value="" className="bg-background text-foreground">
                Select a column…
              </option>
              {headers.map((h) => (
                <option key={h} value={h} className="bg-background text-foreground">
                  {h}
                </option>
              ))}
            </select>
            {samples.length > 0 && (
              <p className="text-[11px] text-subtle mt-1 truncate">Sample: {samples.join(", ")}</p>
            )}
          </label>

          {looksWrong && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 text-amber-400 text-[12px]">
              <AlertCircle size={14} strokeWidth={1.75} className="shrink-0" />
              No “@” in that column&apos;s sample values — is it the right one?
            </div>
          )}

          <label className="block">
            <span className="text-[12px] text-subtle">Tags (comma separated, optional)</span>
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="apollo-scrape, july, client-acme"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <p className="text-[12px] text-subtle">
            {rowCount} row{rowCount === 1 ? "" : "s"} will be verified.
          </p>
        </div>

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm(
                name.trim() || defaultName,
                emailColumn,
                tagText.split(",").map((t) => t.trim()).filter(Boolean)
              )
            }
            disabled={!emailColumn || busy}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start verification"}
          </button>
        </div>
      </div>
    </div>
  );
}
