"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { EmailTemplate, Person, Sequence, SequenceEnrollment, SequenceStep } from "@prisma/client";
import {
  GitBranch,
  Mail,
  CheckSquare,
  StickyNote,
  Plus,
  Trash2,
  Clock,
  Users,
  X,
} from "lucide-react";
import type { TemplateVariable } from "@/lib/template-variables";
import {
  addSequenceStep,
  deleteSequenceStep,
  toggleSequenceActive,
  cancelEnrollment,
  type SequenceStepInput,
  type SequenceStepType,
} from "@/lib/actions/sequences";
import { SequenceStepForm } from "@/components/sequence-step-form";
import { EnrollContactPanel } from "@/components/enroll-contact-panel";

type SequenceWithDetails = Sequence & {
  steps: (SequenceStep & { template: EmailTemplate | null })[];
  enrollments: (SequenceEnrollment & { person: Person })[];
};

const STEP_ICON: Record<SequenceStepType, typeof Mail> = {
  email: Mail,
  task: CheckSquare,
  note: StickyNote,
};

function formatDelay(days: number, hours: number) {
  if (days === 0 && hours === 0) return "Immediately";
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return `${parts.join(" ")} after start`;
}

function stepSummary(step: SequenceStep & { template: EmailTemplate | null }) {
  if (step.type === "email") return step.template?.name ?? step.subject ?? "Custom email";
  if (step.type === "task") return step.taskTitle ?? "Task";
  return "Note";
}

export function SequenceDetailView({
  sequence,
  templates,
  variables,
}: {
  sequence: SequenceWithDetails;
  templates: EmailTemplate[];
  variables: TemplateVariable[];
}) {
  const [addingStep, setAddingStep] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAddStep(input: SequenceStepInput) {
    setStepError(null);
    startTransition(async () => {
      try {
        await addSequenceStep(sequence.id, input);
        setAddingStep(false);
      } catch (err) {
        setStepError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDeleteStep(id: string) {
    if (!confirm("Remove this step?")) return;
    startTransition(() => deleteSequenceStep(id));
  }

  const activeEnrollments = sequence.enrollments.filter((e) => e.status === "active");

  return (
    <div className="flex flex-col h-screen">
      <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px] text-subtle">
          <Link href="/sequences" className="hover:text-foreground transition-colors">
            Sequences
          </Link>
          <span>/</span>
          <span className="text-foreground">{sequence.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startTransition(() => toggleSequenceActive(sequence.id))}
            disabled={pending}
            className={`text-[12px] px-2.5 py-1 rounded-full font-medium transition-colors ${
              sequence.active ? "bg-emerald-500 text-white" : "bg-muted text-subtle"
            }`}
          >
            {sequence.active ? "Active" : "Paused"}
          </button>
          <button
            onClick={() => setEnrolling(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90 transition-opacity"
          >
            <Users size={14} strokeWidth={1.75} />
            Enroll contact
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto grid grid-cols-[1fr_320px]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-medium">Steps</h2>
            <button
              onClick={() => setAddingStep(true)}
              className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
            >
              <Plus size={14} strokeWidth={1.75} />
              Add step
            </button>
          </div>

          {sequence.steps.length === 0 && !addingStep && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <GitBranch size={22} strokeWidth={1.5} className="text-subtle mx-auto" />
              <p className="text-[13px] text-subtle mt-2">No steps yet — add an email, task, or note.</p>
            </div>
          )}

          <div className="space-y-2">
            {sequence.steps.map((step, i) => {
              const Icon = STEP_ICON[step.type as SequenceStepType];
              return (
                <div key={step.id} className="flex items-start gap-3 border border-border rounded-lg p-3 group">
                  <span className="size-6 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-subtle">
                    {i + 1}
                  </span>
                  <Icon size={15} strokeWidth={1.75} className="text-subtle shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">{stepSummary(step)}</p>
                    <p className="flex items-center gap-1 text-[12px] text-subtle mt-0.5">
                      <Clock size={12} strokeWidth={1.75} />
                      {formatDelay(step.delayDays, step.delayHours)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                    title="Remove step"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>

          {stepError && <p className="text-[12px] text-red-400 mt-3">{stepError}</p>}

          {addingStep && (
            <div className="mt-3">
              <SequenceStepForm
                templates={templates}
                variables={variables}
                onCancel={() => setAddingStep(false)}
                onSave={handleAddStep}
              />
            </div>
          )}
        </div>

        <aside className="border-l border-border px-5 py-6">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">
            Enrolled ({activeEnrollments.length})
          </p>
          <div className="mt-2 space-y-1">
            {sequence.enrollments.length === 0 && (
              <p className="text-[13px] text-subtle">No contacts enrolled yet.</p>
            )}
            {sequence.enrollments.map((e) => {
              const name = [e.person.firstName, e.person.lastName].filter(Boolean).join(" ");
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 group">
                  <Link href={`/contacts/${e.person.id}`} className="flex-1 min-w-0 text-[13px] truncate hover:underline">
                    {name}
                  </Link>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      e.status === "active"
                        ? "bg-blue-500 text-white"
                        : e.status === "completed"
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-subtle"
                    }`}
                  >
                    {e.status}
                  </span>
                  {e.status === "active" && (
                    <button
                      onClick={() => confirm("Cancel this enrollment?") && startTransition(() => cancelEnrollment(e.id))}
                      className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                      title="Cancel enrollment"
                    >
                      <X size={12} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {enrolling && <EnrollContactPanel sequenceId={sequence.id} onClose={() => setEnrolling(false)} />}
    </div>
  );
}
