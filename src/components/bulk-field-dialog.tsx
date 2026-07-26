"use client";

import { useState, useTransition } from "react";

export type BulkFieldOption = {
  /** The field key passed back to the server action. */
  field: string;
  label: string;
  /** Picker choices; omit for a free-text field. */
  options?: readonly string[];
  /** Shown under the picker when the field needs a caveat. */
  note?: string;
};

// One dialog for every bulk field edit, on both /companies and /contacts. Picks the field
// first, then the value, so a single button covers N fields without N buttons in the bar.
export function BulkFieldDialog({
  title,
  fields,
  onApply,
  onClose,
}: {
  title: string;
  fields: BulkFieldOption[];
  onApply: (field: string, value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [field, setField] = useState(fields[0]?.field ?? "");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = fields.find((f) => f.field === field);

  function apply() {
    setError(null);
    startTransition(async () => {
      try {
        await onApply(field, value);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not apply the change.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-medium">{title}</p>

        <label className="block text-[11px] font-medium text-subtle uppercase tracking-wide mt-3 mb-1">
          Field
        </label>
        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value);
            setValue("");
          }}
          className="w-full px-2.5 py-1.5 rounded-md border border-border bg-transparent text-[13px] outline-none focus:border-accent"
        >
          {fields.map((f) => (
            <option key={f.field} value={f.field} className="bg-background text-foreground">
              {f.label}
            </option>
          ))}
        </select>

        <label className="block text-[11px] font-medium text-subtle uppercase tracking-wide mt-3 mb-1">
          Value
        </label>
        {active?.options ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md border border-border bg-transparent text-[13px] outline-none focus:border-accent"
          >
            <option value="" className="bg-background text-foreground">
              (clear)
            </option>
            {active.options.map((o) => (
              <option key={o} value={o} className="bg-background text-foreground">
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Leave blank to clear"
            className="w-full px-2.5 py-1.5 rounded-md border border-border bg-transparent text-[13px] outline-none focus:border-accent placeholder:text-subtle"
          />
        )}

        {active?.note && <p className="text-[11.5px] text-subtle mt-2">{active.note}</p>}
        {!value && (
          <p className="text-[11.5px] text-subtle mt-2">
            An empty value clears this field on every selected record.
          </p>
        )}
        {error && <p className="text-[11.5px] text-red-400 mt-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] border border-accent text-accent bg-accent/10 hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
