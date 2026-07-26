import type { Call, SequenceStep, Task } from "@prisma/client";

// Pure helpers for the /lead/[id] highlights bar. Kept out of lead-highlights-bar.tsx
// because that file is "use client" — every export there becomes a client reference, so
// the server page can't call these directly.
export type NextStep =
  | { kind: "task"; id: string; title: string; dueAt: Date | null }
  | { kind: "sequence"; label: string; runAt: Date | null }
  | { kind: "idle"; lastTouch: Date | null };

// Picks what the rep should do next: soonest open task wins, else the next pending sequence
// step, else falls back to how stale the record is.
export function deriveNextStep(
  tasks: Pick<Task, "id" | "title" | "dueAt" | "done">[],
  sequenceSteps: { step: SequenceStep; scheduledFor: Date | null; sequenceName: string }[],
  lastTouch: Date | null
): NextStep {
  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));

  if (open[0]) return { kind: "task", id: open[0].id, title: open[0].title, dueAt: open[0].dueAt };

  const next = sequenceSteps
    .slice()
    .sort((a, b) => (a.scheduledFor?.getTime() ?? Infinity) - (b.scheduledFor?.getTime() ?? Infinity))[0];

  if (next) {
    const type = next.step.type === "email" ? "Email" : next.step.type === "task" ? "Task" : "Note";
    return { kind: "sequence", label: `${next.sequenceName} · ${type}`, runAt: next.scheduledFor };
  }

  return { kind: "idle", lastTouch };
}

// ponytail: lastTouch = newest email/call only. Add meetings when the calendar tab is real.
export function lastTouchOf(emails: { sentAt: Date | null }[], calls: Pick<Call, "startedAt">[]) {
  const dates = [
    ...emails.map((e) => e.sentAt),
    ...calls.map((c) => c.startedAt),
  ].filter((d): d is Date => !!d);
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}
