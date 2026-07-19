"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { searchPeopleForSequence, enrollPeopleInSequence } from "@/lib/actions/sequences";

type Result = { id: string; name: string; email: string | null; alreadyEnrolled: boolean };

export function EnrollContactPanel({ sequenceId, onClose }: { sequenceId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const handle = setTimeout(async () => setResults(await searchPeopleForSequence(sequenceId, query)), 150);
    return () => clearTimeout(handle);
  }, [sequenceId, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEnroll() {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const outcomes = await enrollPeopleInSequence(sequenceId, ids);
      const failed = outcomes.filter((o) => !o.ok);
      setSelected(new Set());
      setResults((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, alreadyEnrolled: true } : r)));
      router.refresh();
      if (failed.length > 0) {
        setError(`${failed.length} contact${failed.length === 1 ? "" : "s"} could not be enrolled.`);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg border border-border bg-background shadow-2xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Enroll contacts</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
          />

          <div className="mt-2 max-h-72 overflow-y-auto">
            {results.map((p) => {
              const isSelected = selected.has(p.id);
              const disabled = p.alreadyEnrolled;
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && toggle(p.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                  }`}
                >
                  <span
                    className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? "bg-accent border-accent" : "border-border"
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    {p.email && <span className="block truncate text-[12px] text-subtle">{p.email}</span>}
                  </span>
                  {disabled && (
                    <span className="text-[11px] text-subtle shrink-0">Enrolled</span>
                  )}
                </button>
              );
            })}
            {query.trim() && results.length === 0 && (
              <p className="px-2.5 py-1.5 text-[12px] text-subtle">No matches.</p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[12px] text-subtle">
            {selected.size > 0 ? `${selected.size} selected` : "Select contacts to enroll"}
          </span>
          <button
            onClick={handleEnroll}
            disabled={selected.size === 0 || pending}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Enroll {selected.size > 0 ? selected.size : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
