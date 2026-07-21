"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, DollarSign, Target, UserCircle, Check } from "lucide-react";
import type { PipelineStage } from "@prisma/client";
import { createOpportunity } from "@/lib/actions/opportunities";
import { searchPeople } from "@/lib/actions/contacts";
import { FieldSection } from "@/components/field-section";

function ContactPicker({
  contactId,
  contactName,
  onPick,
  onClear,
}: {
  contactId: string | null;
  contactName: string;
  onPick: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => setResults(await searchPeople(query)), 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
          <UserCircle size={14} strokeWidth={1.75} />
          Contact
        </div>
        <span className="flex-1 min-w-0 text-[13px] truncate">
          {contactId ? contactName : <span className="text-subtle">No contact</span>}
        </span>
        {contactId && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-subtle hover:text-foreground transition-colors shrink-0"
          >
            <X size={13} strokeWidth={1.75} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-border rounded-lg bg-surface shadow-lg z-20 py-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
          />
          <div className="max-h-48 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPick(p.id, p.name);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
              >
                <span className="truncate">{p.name}</span>
                {contactId === p.id && <Check size={13} strokeWidth={2} className="shrink-0" />}
              </button>
            ))}
            {query.trim() && results.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-subtle">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateDealPanel({
  stages,
  defaultStage,
  onClose,
}: {
  stages: PipelineStage[];
  defaultStage?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState(defaultStage ?? stages[0]?.label ?? "New");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) {
      setError("Deal name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      await createOpportunity({
        name,
        stage,
        value: Math.max(0, Math.round(Number(value) || 0)),
        contactId,
      });
      onClose();
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-40 flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deal name"
            className="flex-1 min-w-0 bg-transparent text-[13px] font-medium outline-none border-b border-transparent focus:border-border placeholder:text-subtle placeholder:font-normal"
          />
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0 ml-2">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide px-1 pb-1">Fields</p>

          <FieldSection title="Deal">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
                <DollarSign size={14} strokeWidth={1.75} />
                Value
              </div>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-subtle"
              />
            </div>
            <div className="flex items-center gap-2 px-1 py-1.5">
              <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
                <Target size={14} strokeWidth={1.75} />
                Stage
              </div>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[13px] outline-none cursor-pointer"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.label} className="bg-background text-foreground">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </FieldSection>

          <FieldSection title="Relations">
            <ContactPicker
              contactId={contactId}
              contactName={contactName}
              onPick={(id, name) => {
                setContactId(id);
                setContactName(name);
              }}
              onClear={() => {
                setContactId(null);
                setContactName("");
              }}
            />
            <p className="px-1 text-[11px] text-subtle">
              Linking a contact also links the deal to that contact&apos;s company.
            </p>
          </FieldSection>

          {error && <p className="px-1 pt-2 text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </>
  );
}
