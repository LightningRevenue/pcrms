"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, GitBranch, X, ArrowUpRight, ChevronRight } from "lucide-react";
import {
  listSequencePerformance,
  getSequenceStepPerformance,
  getSequenceEnrollments,
  type SequenceSummary,
  type StepPerformance,
  type EnrollmentDrillDownRow,
} from "@/lib/actions/sequence-performance-stats";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SequencePerformanceDashboard({ name }: { name: string }) {
  const [sequences, setSequences] = useState<SequenceSummary[] | null>(null);
  const [openSequence, setOpenSequence] = useState<SequenceSummary | null>(null);

  useEffect(() => {
    listSequencePerformance().then(setSequences);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <LayoutGrid size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{name}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto w-full px-6 py-6">
          <div className="border border-border rounded-md overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_90px_90px_90px] gap-3 px-4 py-2 border-b border-border text-[11px] font-medium text-subtle uppercase tracking-wide">
              <span>Sequence</span>
              <span className="text-right">Steps</span>
              <span className="text-right">Active</span>
              <span className="text-right">Completed</span>
              <span className="text-right">Cancelled</span>
            </div>
            {sequences === null ? (
              <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
            ) : sequences.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-8">
                No sequences yet —{" "}
                <Link href="/sequences" className="text-accent hover:underline">
                  create one
                </Link>
                .
              </p>
            ) : (
              sequences.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenSequence(s)}
                  className="w-full grid grid-cols-[1fr_70px_90px_90px_90px] gap-3 px-4 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <GitBranch size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                    <span className="truncate">{s.name}</span>
                    {!s.active && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-subtle shrink-0">Inactive</span>}
                  </span>
                  <span className="text-right tabular-nums text-subtle">{s.stepCount}</span>
                  <span className="text-right tabular-nums">{s.activeEnrollments}</span>
                  <span className="text-right tabular-nums text-emerald-400">{s.completedEnrollments}</span>
                  <span className="text-right tabular-nums text-subtle">{s.cancelledEnrollments}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {openSequence && <SequenceDetailPanel sequence={openSequence} onClose={() => setOpenSequence(null)} />}
    </div>
  );
}

function SequenceDetailPanel({ sequence, onClose }: { sequence: SequenceSummary; onClose: () => void }) {
  const [steps, setSteps] = useState<StepPerformance[] | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<"active" | "completed" | "cancelled" | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentDrillDownRow[] | null>(null);

  useEffect(() => {
    getSequenceStepPerformance(sequence.id).then(setSteps);
  }, [sequence.id]);

  useEffect(() => {
    if (!enrollmentFilter) {
      setEnrollments(null);
      return;
    }
    setEnrollments(null);
    getSequenceEnrollments(sequence.id, enrollmentFilter).then(setEnrollments);
  }, [sequence.id, enrollmentFilter]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-[420px] bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[13px] font-medium truncate">{sequence.name}</p>
            <Link
              href={`/sequences/${sequence.id}`}
              className="flex items-center gap-1 text-[11px] text-subtle hover:text-foreground transition-colors shrink-0"
            >
              Open <ArrowUpRight size={11} strokeWidth={1.75} />
            </Link>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
            {(["active", "completed", "cancelled"] as const).map((status) => {
              const count = status === "active" ? sequence.activeEnrollments : status === "completed" ? sequence.completedEnrollments : sequence.cancelledEnrollments;
              return (
                <button
                  key={status}
                  onClick={() => setEnrollmentFilter((f) => (f === status ? null : status))}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                    enrollmentFilter === status ? "border-accent bg-accent/10 text-accent" : "border-border text-subtle hover:bg-muted"
                  }`}
                >
                  {count} {status}
                </button>
              );
            })}
          </div>

          {enrollmentFilter ? (
            enrollments === null ? (
              <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
            ) : enrollments.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-8">No enrollments here.</p>
            ) : (
              <div className="divide-y divide-border">
                {enrollments.map((e) => (
                  <Link
                    key={e.id}
                    href={`/contacts/${e.personId}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                  >
                    <span className="text-[13px] truncate">{e.personName}</span>
                    <span className="flex items-center gap-2 shrink-0 text-[12px] text-subtle">
                      {formatDate(e.enrolledAt)}
                      <ArrowUpRight size={12} strokeWidth={1.75} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="px-4 py-3">
              <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">Steps</p>
              {steps === null ? (
                <p className="text-[13px] text-subtle text-center py-6">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div key={step.stepId} className="flex items-center gap-2 text-[13px]">
                      <ChevronRight size={12} strokeWidth={1.75} className="text-subtle shrink-0" />
                      <span className="w-16 shrink-0 text-subtle">{step.label}</span>
                      <span className="flex-1 flex items-center gap-2 text-[12px] text-subtle">
                        <span className="text-emerald-400">{step.sent} sent</span>
                        {step.pending > 0 && <span>{step.pending} pending</span>}
                        {step.skipped > 0 && <span>{step.skipped} skipped</span>}
                        {step.failed > 0 && <span className="text-red-400">{step.failed} failed</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
