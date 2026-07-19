"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, GitBranch } from "lucide-react";
import type { Sequence } from "@prisma/client";
import { DatePicker } from "@/components/date-picker";
import { listActiveSequencesForEnrollment, enrollPersonInSequence } from "@/lib/actions/sequences";

type SequenceOption = Sequence & { _count: { steps: number } };

export function AddToSequencePanel({
  personId,
  onClose,
}: {
  personId: string;
  onClose: () => void;
}) {
  const [sequences, setSequences] = useState<SequenceOption[] | null>(null);
  const [sequenceId, setSequenceId] = useState("");
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    listActiveSequencesForEnrollment().then((list) => {
      setSequences(list);
      if (list.length > 0) setSequenceId(list[0].id);
    });
  }, []);

  function handleEnroll() {
    if (!sequenceId) return;
    if (timing === "scheduled" && !scheduledFor) {
      setError("Pick a date and time");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await enrollPersonInSequence(
          sequenceId,
          personId,
          timing === "scheduled" ? new Date(scheduledFor) : undefined
        );
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to enroll");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg border border-border bg-background shadow-2xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Add to sequence</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {sequences === null ? (
            <p className="text-[13px] text-subtle">Loading sequences…</p>
          ) : sequences.length === 0 ? (
            <p className="text-[13px] text-subtle">
              No active sequences with steps yet. Create one from the Sequences page first.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="text-[12px] text-subtle">Sequence</span>
                <select
                  value={sequenceId}
                  onChange={(e) => setSequenceId(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
                >
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id} className="bg-background text-foreground">
                      {s.name} ({s._count.steps} steps)
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-[12px] text-subtle">Start</span>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => setTiming("now")}
                    className={`flex-1 px-2.5 py-1.5 rounded-md border text-[13px] transition-colors ${
                      timing === "now"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-subtle hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Right away
                  </button>
                  <button
                    onClick={() => setTiming("scheduled")}
                    className={`flex-1 px-2.5 py-1.5 rounded-md border text-[13px] transition-colors ${
                      timing === "scheduled"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-subtle hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {timing === "scheduled" && (
                <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border">
                  <DatePicker value={scheduledFor} onChange={setScheduledFor} />
                </label>
              )}

              <p className="text-[12px] text-subtle">
                {timing === "now"
                  ? "Step delays count from right now."
                  : "Step delays will count from the date/time above."}
              </p>
            </>
          )}

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        {sequences && sequences.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-end">
            <button
              onClick={handleEnroll}
              disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <GitBranch size={14} strokeWidth={1.75} />
              Enroll
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
